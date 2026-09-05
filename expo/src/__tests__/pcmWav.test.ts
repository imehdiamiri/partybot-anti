import { pcm16ToWav } from '../utils/pcmWav';

test('PCM WAV preserves frames and the actual capture sample rate/channels', () => {
  const wav = pcm16ToWav([new Uint8Array([1, 2]), new Uint8Array([3, 4])], 48000, 2);
  const view = new DataView(wav.buffer);
  expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(22, true)).toBe(2);
  expect(view.getUint32(28, true)).toBe(192000);
  expect(view.getUint32(40, true)).toBe(4);
  expect([...wav.slice(44)]).toEqual([1, 2, 3, 4]);
});

test('PCM WAV rejects empty audio, invalid formats and partial frames', () => {
  expect(() => pcm16ToWav([], 44100, 1)).toThrow();
  expect(() => pcm16ToWav([new Uint8Array(2)], 0, 1)).toThrow();
  expect(() => pcm16ToWav([new Uint8Array(3)], 44100, 1)).toThrow();
});
