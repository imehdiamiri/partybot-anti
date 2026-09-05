/** Encode little-endian interleaved PCM16 using the actual microphone format. */
export function pcm16ToWav(chunks: Uint8Array[], sampleRate: number, channels: number): Uint8Array {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || !Number.isInteger(channels) || channels <= 0) {
    throw new Error('Invalid PCM format');
  }
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  if (!dataLength || dataLength % (channels * 2)) throw new Error('Incomplete PCM frames');
  const result = new Uint8Array(44 + dataLength);
  const view = new DataView(result.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => result[offset + i] = c.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
