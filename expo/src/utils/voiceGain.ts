/** Raise quiet recordings without clipping, changing timing, or boosting silence. */
export function voiceGain(peak: number): number {
  if (!Number.isFinite(peak) || peak < 0.001) return 1;
  return Math.max(1, Math.min(16, 0.92 / peak));
}

export function normalizeVoiceChannels(channels: Float32Array[]): void {
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  const gain = voiceGain(peak);
  if (gain === 1) return;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
}

/** Normalize a PCM16 WAV produced by pcm16ToWav, including all interleaved channels. */
export function normalizeVoiceWav(wav: Uint8Array): void {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)) / 32768);
  const gain = voiceGain(peak);
  if (gain === 1) return;
  for (let i = 44; i < wav.length; i += 2) view.setInt16(i, Math.round(view.getInt16(i, true) * gain), true);
}
