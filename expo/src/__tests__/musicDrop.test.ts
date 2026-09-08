import fs from 'fs';
import path from 'path';

test('original music cue keeps the scoring target aligned with its audible drop', () => {
  const wav = fs.readFileSync(path.resolve(__dirname, '../../assets/sounds/music_drop.wav'));
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  const rate = wav.readUInt32LE(24);
  expect(rate).toBe(44100);
  expect(wav.readUInt32LE(40)).toBe(rate * 12 * 2);
  const sample = (time: number) => wav.readInt16LE(44 + Math.floor(time * rate) * 2);
  expect(sample(9)).toBe(0);
  expect(sample(9.69)).toBe(0);
  expect(Math.abs(sample(9.71))).toBeGreaterThan(100);
  const source = fs.readFileSync(path.resolve(__dirname, '../components/games/DrumChallengeSession.tsx'), 'utf8');
  expect(source).toContain('beatTime: 9700');
  expect(source).toContain('sounds/music_drop.wav');
});
