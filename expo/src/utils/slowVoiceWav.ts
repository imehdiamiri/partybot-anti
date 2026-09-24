/** Half-speed PCM playback without platform time-stretch/pitch-correction engines.
 * Samples and gain are unchanged; halving the sample clock doubles duration.
 */
export function slowVoiceWav(input: Uint8Array): Uint8Array {
  const output = input.slice();
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const text = (offset: number, count: number) => String.fromCharCode(...output.subarray(offset, offset + count));
  if (output.length < 44 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('Invalid recording');
  for (let offset = 12; offset + 8 <= output.length;) {
    const size = view.getUint32(offset + 4, true);
    if (text(offset, 4) === 'fmt ') {
      if (size < 16 || offset + 8 + size > output.length || view.getUint16(offset + 8, true) !== 1) throw new Error('PCM recording required');
      const rate = Math.round(view.getUint32(offset + 12, true) / 2);
      view.setUint32(offset + 12, rate, true);
      view.setUint32(offset + 16, rate * view.getUint16(offset + 20, true), true);
      return output;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('Recording format missing');
}
