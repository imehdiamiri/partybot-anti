import { getGameHint } from '../constants/GameModeHints';

test.each([
  ['pass_guess', {}, 'classic', 'Classic Q&A'],
  ['pass_guess', {}, 'whoSaidIt', 'Who Said It?'],
  ['imposter', { gameStyle: 'clue' }, undefined, 'Clue Mode'],
  ['imposter', { gameStyle: 'discussion' }, undefined, 'Discussion'],
  ['memory_path', { gameMode: 'turnBased' }, undefined, 'Turn Based'],
  ['memory_path', { gameMode: 'timeRace' }, undefined, 'Time Race'],
  ['drum_challenge', { drumMode: 'metronome' }, undefined, 'Metronome'],
  ['drum_challenge', { drumMode: 'whitney' }, undefined, 'Music Drop'],
  ['draw_rush', { conceptMode: 'freeDraw' }, undefined, 'Free Draw'],
  ['draw_rush', { conceptMode: 'preset' }, undefined, 'Prompt'],
] as const)('selects the %s mode guide', (game, config, mode, title) => {
  const hint = getGameHint(game, config, mode);
  expect(hint.title).toContain(title);
  expect(hint.tip.split(' | ')).toHaveLength(3);
  expect(hint.icon).toBeTruthy();
});
test('free statements do not instruct players to answer a shared question', () => {
  expect(getGameHint('pass_guess', {}, 'whoSaidIt').tip).toContain('no shared question');
  expect(getGameHint('pass_guess', {}, 'classic').tip).toContain('same question');
});
test('unmodified games preserve their guide', () => {
  expect(getGameHint('color_match').title).toBe('Color Match');
});
