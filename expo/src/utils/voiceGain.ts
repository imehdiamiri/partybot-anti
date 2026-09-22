/** Speech loudness, rather than a single peak, determines recording gain. */
export function voiceGain(activeRms: number): number {
  if (!Number.isFinite(activeRms) || activeRms < 0.00015) return 1;
  return Math.max(1, Math.min(64, 0.28 / activeRms));
}

/** Linked-channel, fixed gain avoids pumping; soft limiting contains loud transients. */
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
  if (gain === 1) return;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const amplified = channel[i] * gain;
      // Linear across normal speech, smooth knee above 75% full scale.
      const magnitude = Math.abs(amplified);
      channel[i] = magnitude <= 0.75 ? amplified
        : Math.sign(amplified) * (0.75 + 0.23 * Math.tanh((magnitude - 0.75) / 0.23));
    }
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
