import { metronomePlan, metronomeError } from '../utils/metronomeChallenge';

test.each([['4/4', 16, 16000], ['3/4', 12, 14400], ['6/8', 24, 12000], ['8/8', 32, 16000]])('%s has four audible and four silent bars', (id, count, target) => {
  const plan = metronomePlan(String(id));
  expect(plan.ticks).toHaveLength(Number(count));
  expect(plan.targetMs).toBe(target);
  expect(plan.audibleMs * 2).toBe(target);
  expect(plan.ticks.every(t => t.atMs < plan.audibleMs)).toBe(true);
  expect(metronomeError(plan.targetMs, plan)).toBe(0);
  expect(metronomeError(plan.targetMs - 125, plan)).toBe(-125);
  expect(metronomeError(plan.targetMs + 150, plan)).toBe(150);
});
test('compound meters accent groups and legacy presets fall back safely', () => {
  expect(metronomePlan('6/8').ticks.slice(0, 6).map(t => t.accent)).toEqual([true,false,false,true,false,false]);
  expect(metronomePlan('8/8').ticks.slice(0, 8).map(t => t.accent)).toEqual([true,false,false,true,false,false,true,false]);
  expect(metronomePlan('fast').rhythm.id).toBe('4/4');
});
