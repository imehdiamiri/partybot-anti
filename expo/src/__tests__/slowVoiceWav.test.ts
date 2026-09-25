import { slowVoiceWav } from '../utils/slowVoiceWav';
import { pcm16ToWav } from '../utils/pcmWav';
import { stretchVoice } from '../utils/stretchVoice';

const strength = (samples: Float32Array, rate: number, hz: number) => {
  let real = 0, imaginary = 0;
  for (let i = Math.round(rate * .1); i < samples.length - rate * .1; i++) {
    real += samples[i] * Math.cos(2 * Math.PI * hz * i / rate);
    imaginary += samples[i] * Math.sin(2 * Math.PI * hz * i / rate);
  }
  return Math.hypot(real, imaginary);
};
test.each([110, 220, 440, 880])('doubles duration while retaining %i Hz instead of dropping an octave', frequency => {
  const rate = 22050;
  const input = Float32Array.from({ length: rate }, (_, i) => .6 * Math.sin(2 * Math.PI * frequency * i / rate));
  const [output] = stretchVoice([input], rate);
  expect(output.length).toBe(input.length * 2);
  expect(strength(output, rate, frequency)).toBeGreaterThan(strength(output, rate, frequency / 2) * 20);
  let crossings = 0;
  for (let i = rate / 5 | 0; i < output.length - rate / 5; i++) if (output[i] <= 0 && output[i + 1] > 0) crossings++;
  expect(Math.abs(crossings / 1.6 - frequency)).toBeLessThan(3);
});
test.each([1, 2])('native PCM retains sample clock and linked channel phase for %i channels', channels => {
  const pcm = new Uint8Array(44100 * channels * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < 44100; i++) for (let c = 0; c < channels; c++) view.setInt16((i * channels + c) * 2, Math.round(16000 * Math.sin(i * Math.PI * 2 * 220 / 44100)) * (c ? -1 : 1), true);
  const wav = pcm16ToWav([pcm], 44100, channels);
  const slow = slowVoiceWav(wav), header = new DataView(slow.buffer);
  expect(header.getUint32(24, true)).toBe(44100);
  expect(header.getUint32(40, true) / header.getUint32(28, true)).toBe(2);
  if (channels === 2) for (let i = 44; i < slow.length; i += 4) expect(Math.abs(header.getInt16(i, true) + header.getInt16(i + 2, true))).toBeLessThanOrEqual(1);
});
test('silence remains finite and silent; invalid files fail clearly', () => {
  expect(stretchVoice([new Float32Array(1000)], 44100)[0].every(x => x === 0)).toBe(true);
  expect(() => slowVoiceWav(new Uint8Array(44))).toThrow('Invalid recording');
});
