import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

test('Whitney mode preserves the original recording and scores its audible drum attack', () => {
  const wav = fs.readFileSync(path.resolve(__dirname, '../../assets/sounds/whitney_raw.wav'));
  expect(createHash('sha256').update(wav).digest('hex')).toBe('96d64b877cf3658ef0cbf95db82c2c89d51d26a172ba2e74e5abea6060d6669d');
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  const rate = wav.readUInt32LE(24);
  expect(rate).toBe(22050);
  expect(wav.readUInt32LE(40)).toBe(rate * 12 * 2);
  const rms = (start: number, end: number) => {
    let total = 0; let count = 0;
    for (let i = Math.floor(start * rate); i < Math.floor(end * rate); i++) {
      total += (wav.readInt16LE(44 + i * 2) / 32768) ** 2; count++;
    }
    return Math.sqrt(total / count);
  };
  expect(rms(9.80, 9.86)).toBeLessThan(0.02);
  expect(rms(9.86, 9.91)).toBeGreaterThan(0.15);
  const source = fs.readFileSync(path.resolve(__dirname, '../components/games/DrumChallengeSession.tsx'), 'utf8');
  expect(source).toContain('beatTime: 9860');
  const androidWeb = fs.readFileSync(path.resolve(__dirname, '../services/drumMusic.ts'), 'utf8');
  const ios = fs.readFileSync(path.resolve(__dirname, '../services/drumMusic.ios.ts'), 'utf8');
  expect(androidWeb).toContain('sounds/whitney_raw.wav');
  expect(ios).not.toContain('require(');
  expect(ios).toContain('whitneyAvailable = false');
  expect(source).toContain('!whitneyAvailable');
});
