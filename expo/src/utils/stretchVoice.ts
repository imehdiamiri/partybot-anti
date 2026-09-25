/** 2x duration at the original pitch using waveform-similarity overlap-add.
 * Windows keep their original sample rate; only the spacing between them changes.
 * Every channel shares the same alignment to preserve stereo phase.
 */
export function stretchVoice(channels: Float32Array[], sampleRate: number): Float32Array[] {
  const length = channels[0]?.length ?? 0;
  if (!length || !sampleRate || channels.some(channel => channel.length !== length)) throw new Error('Invalid voice samples');
  const output = channels.map(() => new Float32Array(length * 2));
  const hop = Math.max(1, Math.min(Math.round(sampleRate * .016), Math.floor(length / 2)));
  const window = hop * 2;
  const search = Math.round(sampleRate * .008);
  for (let channel = 0; channel < channels.length; channel++) output[channel].set(channels[channel].subarray(0, window));
  for (let position = hop; position < length * 2; position += hop) {
    const expected = Math.min(length - window, Math.round(position / 2));
    let best = Math.max(0, expected), bestScore = -Infinity;
    const low = Math.max(0, expected - search), high = Math.min(length - window, expected + search);
    let energy = 0;
    for (let j = 0; j < hop && position + j < length * 2; j += 8) energy += output[0][position + j] ** 2;
    if (energy > 1e-9) for (let candidate = low; candidate <= high; candidate += 4) {
      let dot = 0, norm = 0;
      for (let j = 0; j < hop && position + j < length * 2; j += 8) {
        const value = channels[0][candidate + j];
        dot += output[0][position + j] * value; norm += value * value;
      }
      const score = dot / Math.sqrt(energy * norm + 1e-20) - Math.abs(candidate - expected) * 1e-7;
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    for (let channel = 0; channel < channels.length; channel++) for (let j = 0; j < window && position + j < length * 2; j++) {
      const value = channels[channel][Math.min(length - 1, best + j)];
      const mix = Math.min(1, j / hop);
      output[channel][position + j] = output[channel][position + j] * (1 - mix) + value * mix;
    }
  }
  return output;
}
