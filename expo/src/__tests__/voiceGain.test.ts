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
  expect(voiceGain(0.001)).toBe(256);
  expect(voiceGain(0.6)).toBe(1);
  const silent = new Float32Array(1000);
  normalizeVoiceChannels([silent]);
  expect(silent.every(x => x === 0)).toBe(true);
  const loud = speech(0.8), copy = loud.slice();
  normalizeVoiceChannels([loud]);
  expect(loud).toEqual(copy);
});

test.each([16000, 44100, 48000])('very quiet takes are audible in both directions at %i Hz without clipped peaks', sampleRate => {
  const quiet = Float32Array.from({ length: sampleRate }, (_, i) => 0.002 * Math.sin(2 * Math.PI * 220 * i / sampleRate));
  quiet[0] = 0.9; // A handling bump must not set the gain of the whole take.
  const originalRms = rms(quiet.slice(sampleRate / 5));
  normalizeVoiceChannels([quiet], sampleRate);
  const audible = rms(quiet.slice(sampleRate / 5));
  expect(audible).toBeGreaterThan(0.34);
  expect(audible / originalRms).toBeGreaterThan(240);
  expect(quiet.every(x => Number.isFinite(x) && Math.abs(x) <= 0.89001)).toBe(true);
  expect(rms(quiet.slice().reverse())).toBeCloseTo(rms(quiet), 6);
});

test('typical soft singing reaches the louder playback target, without boosting digital silence', () => {
  const soft = speech(0.03);
  normalizeVoiceChannels([soft]);
  expect(rms(soft)).toBeGreaterThan(0.44);
  expect(rms(soft)).toBeLessThan(0.46);
  const silent = new Float32Array(44100);
  normalizeVoiceChannels([silent]);
  expect(silent.every(x => x === 0)).toBe(true);
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

test('loud singing remains sinusoidal instead of flattening into distortion', () => {
  const input = speech(0.01);
  for (let i = 12000; i < 22000; i++) input[i] *= 40;
  const original = input.slice();
  normalizeVoiceChannels([input]);
  expect(Math.max(...input.map(Math.abs))).toBeLessThanOrEqual(0.89001);
  // Least-squares residual measures added waveform distortion on the sustained
  // loud note, away from its attack/release. A saturating soft clipper fails this.
  let cross = 0, energy = 0;
  for (let i = 15000; i < 20000; i++) { cross += input[i] * original[i]; energy += original[i] ** 2; }
  const scale = cross / energy;
  let residual = 0, outputEnergy = 0;
  for (let i = 15000; i < 20000; i++) { residual += (input[i] - original[i] * scale) ** 2; outputEnergy += input[i] ** 2; }
  expect(Math.sqrt(residual / outputEnergy)).toBeLessThan(0.01);
  expect(rms(input.slice(15000, 20000))).toBeGreaterThan(0.5);
});

test('over-range transients have headroom even when no boost is needed', () => {
  const left = speech(0.8), right = Float32Array.from(left, x => x * 0.5);
  left[0] = 1.2; right[0] = 0.6;
  normalizeVoiceChannels([left, right]);
  expect(left.every(x => Math.abs(x) <= 0.89001)).toBe(true);
  for (let i = 0; i < left.length; i += 97) expect(right[i]).toBeCloseTo(left[i] * 0.5, 5);
});
