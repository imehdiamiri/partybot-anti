import { stretchVoice } from './stretchVoice';
import { pcm16ToWav } from './pcmWav';

/** Pitch-preserving 0.5x playback as ordinary PCM: identical on native and web. */
export function slowVoiceWav(input: Uint8Array): Uint8Array {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const text = (offset: number, count: number) => String.fromCharCode(...input.subarray(offset, offset + count));
  if (input.length < 44 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('Invalid recording');
  let rate = 0, count = 0, dataStart = 0, dataSize = 0;
  for (let offset = 12; offset + 8 <= input.length;) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > input.length) throw new Error('Truncated recording');
    if (text(offset, 4) === 'fmt ') {
      if (size < 16 || view.getUint16(offset + 8, true) !== 1 || view.getUint16(offset + 22, true) !== 16) throw new Error('PCM16 recording required');
      count = view.getUint16(offset + 10, true); rate = view.getUint32(offset + 12, true);
    }
    if (text(offset, 4) === 'data') { dataStart = offset + 8; dataSize = size; }
    offset += 8 + size + (size % 2);
  }
  if (!rate || !count || !dataSize || dataSize % (count * 2)) throw new Error('Recording format missing');
  const length = dataSize / (count * 2);
  const channels = Array.from({ length: count }, (_, channel) => {
    const values = new Float32Array(length);
    for (let i = 0; i < length; i++) values[i] = view.getInt16(dataStart + (i * count + channel) * 2, true) / 32768;
    return values;
  });
  const stretched = stretchVoice(channels, rate);
  const pcm = new Uint8Array(dataSize * 2), samples = new DataView(pcm.buffer);
  for (let i = 0; i < length * 2; i++) for (let channel = 0; channel < count; channel++) {
    samples.setInt16((i * count + channel) * 2, Math.max(-32768, Math.min(32767, Math.round(stretched[channel][i] * 32768))), true);
  }
  return pcm16ToWav([pcm], rate, count);
}
