import fs from 'fs';
import path from 'path';
import { whitneyAvailable, whitneyAudio } from '../services/drumMusic';
import { getGameHint } from '../constants/GameModeHints';

test('retired commercial recording is absent and old sessions use the metronome', () => {
  expect(whitneyAvailable).toBe(false);
  expect(whitneyAudio).toBeNull();
  expect(fs.existsSync(path.resolve(__dirname, '../../assets/sounds/whitney_raw.wav'))).toBe(false);
  expect(getGameHint('drum_challenge', { drumMode: 'whitney' }).title).toContain('Metronome');
  expect(getGameHint('drum_challenge').title).toContain('Metronome');
  expect(fs.existsSync(path.resolve(__dirname, '../../assets/sounds/metronome_challenge.wav'))).toBe(true);
  const ios = fs.readFileSync(path.resolve(__dirname, '../services/drumMusic.ios.ts'), 'utf8');
  expect(ios).not.toContain('require(');
  expect(ios).toContain('whitneyAvailable = false');
});