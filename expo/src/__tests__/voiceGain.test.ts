import { normalizeVoiceChannels, normalizeVoiceWav, voiceGain } from '../utils/voiceGain';
import { pcm16ToWav } from '../utils/pcmWav';

const speech = (amplitude: number) => Float32Array.from({ length: 44100 }, (_, i) => amplitude * Math.sin(2 * Math.PI * 440 * i / 44100));
const rms = (a: Float32Array) => Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length);

test('a handling transient no longer prevents quiet singing from becoming audible', () => {
  const quiet = speech(0.008);
  quiet[100] = 0.95;
  const before = rms(quiet.slice(1000));
  normalizeVoiceChannels([quiet]);
  expect(rms(quiet.slice(1000))).toBeGreaterThan(before * 30);
  expect(rms(quiet.slice(1000))).toBeGreaterThan(0.25);
  expect(quiet.every(x => Number.isFinite(x) && Math.abs(x) <= 0.981)).toBe(true);
});

test('silence and already loud audio are preserved; very quiet speech has bounded gain', () => {
  expect(voiceGain(0)).toBe(1);
  expect(voiceGain(0.0001)).toBe(1);
  expect(voiceGain(0.001)).toBe(64);
  expect(voiceGain(0.4)).toBe(1);
  const silent = new Float32Array(1000);
  normalizeVoiceChannels([silent]);
  expect(silent.every(x => x === 0)).toBe(true);
  const loud = speech(0.8), copy = loud.slice();
  normalizeVoiceChannels([loud]);
  expect(loud).toEqual(copy);
});

test('linked channels preserve stereo balance below the limiter knee', () => {
  const left = speech(0.03), right = Float32Array.from(left, x => x * 0.5);
  normalizeVoiceChannels([left, right]);
  for (let i = 0; i < left.length; i += 97) expect(right[i]).toBeCloseTo(left[i] * 0.5, 5);
});

test('native and web processing agree while preserving PCM timing and channels', () => {
  const raw = new Uint8Array(44100 * 4), data = new DataView(raw.buffer);
  const left = speech(0.015), right = speech(0.008);
  for (let i = 0; i < left.length; i++) {
    data.setInt16(i * 4, Math.round(left[i] * 32768), true);
    data.setInt16(i * 4 + 2, Math.round(right[i] * 32768), true);
    left[i] = data.getInt16(i * 4, true) / 32768;
    right[i] = data.getInt16(i * 4 + 2, true) / 32768;
  }
  const wav = pcm16ToWav([raw], 44100, 2), header = wav.slice(0, 44);
  normalizeVoiceWav(wav); normalizeVoiceChannels([left, right]);
  expect(wav.slice(0, 44)).toEqual(header);
  const output = new DataView(wav.buffer);
  for (let i = 0; i < left.length; i += 113) {
    expect(output.getInt16(44 + i * 4, true) / 32768).toBeCloseTo(left[i], 4);
    expect(output.getInt16(46 + i * 4, true) / 32768).toBeCloseTo(right[i], 4);
  }
});
