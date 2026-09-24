import { slowVoiceWav } from '../utils/slowVoiceWav';
import { pcm16ToWav } from '../utils/pcmWav';

test.each([1, 2])('half speed preserves every PCM frame and doubles duration for %i channels', channels => {
  const pcm = new Uint8Array(44100 * channels * 2 * 3);
  for (let i = 0; i < pcm.length; i++) pcm[i] = i % 251;
  const wav = pcm16ToWav([pcm], 44100, channels);
  const slow = slowVoiceWav(wav);
  const header = new DataView(slow.buffer);
  expect(header.getUint32(24, true)).toBe(22050);
  expect(header.getUint32(40, true) / header.getUint32(28, true)).toBe(6);
  expect(slow.subarray(44)).toEqual(wav.subarray(44));
  expect(new DataView(wav.buffer).getUint32(24, true)).toBe(44100);
});
test('rejects invalid audio instead of creating an unplayable slow file', () => {
  expect(() => slowVoiceWav(new Uint8Array(44))).toThrow('Invalid recording');
});
