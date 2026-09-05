import { canStartReverseTake } from '../utils/reverseSingingFlow';
import fs from 'fs';
import path from 'path';

test('only player one can record a new round', () => {
  expect(canStartReverseTake(1, false, false, false)).toBe(true);
  expect(canStartReverseTake(2, false, false, false)).toBe(false);
});
test('source locks immediately and mimic waits for successful reversal', () => {
  expect(canStartReverseTake(1, true, false, false)).toBe(false);
  expect(canStartReverseTake(2, true, false, false)).toBe(false);
  expect(canStartReverseTake(2, true, true, false)).toBe(true);
});
test('processing or capturing blocks simultaneous recording', () => {
  expect(canStartReverseTake(1, false, false, true)).toBe(false);
  expect(canStartReverseTake(2, true, true, true)).toBe(false);
});
test('Retry clears both takes, including reversed URLs, and both timers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/games/ReverseSingingSession.tsx'), 'utf8');
  const retry = source.split('async function retryRound()')[1].split('// ── Request mic permission')[0];
  for (const field of ['P1Uri', 'P1ReversedUri', 'P2Uri', 'P2ReversedUri']) expect(retry).toContain(`set${field}(null)`);
  expect(retry).toContain('setP1Duration(0)'); expect(retry).toContain('setP2Duration(0)');
  expect(retry).toContain('await stopPlayback()'); expect(retry).toContain('revokeAllTrackedUrls()');
});
