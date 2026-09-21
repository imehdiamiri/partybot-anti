import { normalizeVoiceChannels, normalizeVoiceWav, voiceGain } from '../utils/voiceGain';
import { pcm16ToWav } from '../utils/pcmWav';

test('quiet speech gets louder with consistent stereo balance and peak headroom', () => {
  const channels = [new Float32Array([0, 0.1, -0.2]), new Float32Array([0.05, -0.1, 0])];
  normalizeVoiceChannels(channels);
  expect(channels[0][2]).toBeCloseTo(-0.92);
  expect(channels[0][1]).toBeCloseTo(0.46);
  expect(channels[1][0]).toBeCloseTo(0.23);
});

test('silence is untouched and very quiet recordings have a bounded gain', () => {
  expect(voiceGain(0)).toBe(1);
  expect(voiceGain(0.0001)).toBe(1);
  expect(voiceGain(0.005)).toBe(16);
  expect(voiceGain(0.95)).toBe(1);
  expect(voiceGain(NaN)).toBe(1);
});

test('native PCM recording gains match web and retain WAV timing and channels', () => {
  const raw = new Uint8Array(8);
  const data = new DataView(raw.buffer);
  [1000, -2000, 500, -1000].forEach((sample, i) => data.setInt16(i * 2, sample, true));
  const wav = pcm16ToWav([raw], 48000, 2);
  const header = wav.slice(0, 44);
  normalizeVoiceWav(wav);
  expect(wav.slice(0, 44)).toEqual(header);
  const view = new DataView(wav.buffer);
  expect(view.getInt16(46, true)).toBe(-30147);
  expect(view.getInt16(44, true)).toBe(15073);
  expect(view.getInt16(48, true)).toBe(7537);
});

test('already loud PCM and float recordings remain unchanged', () => {
  const loud = new Float32Array([1, -1, 0.5]);
  normalizeVoiceChannels([loud]);
  expect([...loud]).toEqual([1, -1, 0.5]);
  const raw = new Uint8Array([0, 128, 255, 127]);
  const wav = pcm16ToWav([raw], 44100, 1);
  normalizeVoiceWav(wav);
  expect(wav.slice(44)).toEqual(raw);
});
