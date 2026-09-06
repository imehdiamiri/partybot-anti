import { GAME_SOUND_FILES, GAME_SAMPLE_RATE, synthesizeGameCue } from '../services/GameSoundDesign';
test.each(Object.keys(GAME_SOUND_FILES) as (keyof typeof GAME_SOUND_FILES)[])('%s is short, bounded, original event audio', id => {
  const pcm = synthesizeGameCue(id);
  expect(pcm.length / GAME_SAMPLE_RATE).toBeLessThan(0.5);
  expect(pcm.every(x => Number.isFinite(x) && Math.abs(x) <= 0.8)).toBe(true);
  expect(pcm.some(x => Math.abs(x) > 0.02)).toBe(true);
  expect(Math.abs(pcm[pcm.length - 1])).toBeLessThan(0.001);
});
test('flip, match and mismatch have distinct waveforms', () => {
  expect(Array.from(synthesizeGameCue('tileFlip'))).not.toEqual(Array.from(synthesizeGameCue('match')));
  expect(Array.from(synthesizeGameCue('match'))).not.toEqual(Array.from(synthesizeGameCue('wrong')));
});
