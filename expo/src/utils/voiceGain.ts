/** Speech loudness, rather than a single peak, determines recording gain. */
export function voiceGain(activeRms: number): number {
  if (!Number.isFinite(activeRms) || activeRms < 0.00015) return 1;
  return Math.max(1, Math.min(64, 0.28 / activeRms));
}

/** Offline look-ahead gain limiting preserves wave shapes instead of saturating samples. */
export function normalizeVoiceChannels(channels: Float32Array[], sampleRate = 44100): void {
  if (!channels.length || !channels[0].length) return;
  const frames = channels[0].length;
  const window = Math.max(1, Math.round(sampleRate * 0.02));
  const levels: number[] = [];
  for (let start = 0; start < frames; start += window) {
    const end = Math.min(frames, start + window);
    let energy = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i++) energy += channel[i] * channel[i];
    }
    const rms = Math.sqrt(energy / ((end - start) * channels.length));
    // Exclude silence without letting one handling bump set the speech threshold.
    if (rms >= 0.00015 && Number.isFinite(rms)) levels.push(rms);
  }
  if (!levels.length) return;
  levels.sort((a, b) => a - b);
  const gain = voiceGain(levels[Math.floor((levels.length - 1) * 0.65)]);
  // Leave reconstruction headroom. Do not waveshape with tanh: a sustained loud
  // syllable otherwise becomes flattened even though its numerical peak is < 1.
  const ceiling = 0.89;
  const envelope = new Float32Array(frames);
  const attack = Math.exp(-1 / (sampleRate * 0.005));
  const release = Math.exp(-1 / (sampleRate * 0.05));
  let next = 1;
  for (let i = frames - 1; i >= 0; i--) {
    let peak = 0;
    for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i]) * gain);
    const required = peak > ceiling ? ceiling / peak : 1;
    // Reading backwards anticipates a transient before it arrives. The envelope
    // never exceeds the exact per-frame safe gain, including the first sample.
    next = Math.min(required, next / attack);
    envelope[i] = next;
  }
  let previous = envelope[0];
  for (let i = 0; i < frames; i++) {
    previous = Math.min(envelope[i], previous / release);
    const linkedGain = gain * previous;
    for (const channel of channels) channel[i] *= linkedGain;
  }
}

/** Normalize genuine PCM16 captured by GameAudio before both playback directions. */
export function normalizeVoiceWav(wav: Uint8Array): void {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const frames = (wav.length - 44) / (2 * channels);
  const pcm = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) pcm[c][i] = view.getInt16(44 + (i * channels + c) * 2, true) / 32768;
  }
  normalizeVoiceChannels(pcm, sampleRate);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) view.setInt16(44 + (i * channels + c) * 2, Math.max(-32768, Math.min(32767, Math.round(pcm[c][i] * 32768))), true);
  }
}
