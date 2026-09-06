export const METRONOME_RHYTHMS = [
  { id: '4/4', title: '4/4', sub: 'Quarter = 120 · 1+1+1+1', groups: [1, 1, 1, 1], pulseMs: 500 },
  { id: '3/4', title: '3/4 Waltz', sub: 'Quarter = 100 · 1+1+1', groups: [1, 1, 1], pulseMs: 600 },
  { id: '6/8', title: '6/8', sub: 'Dotted quarter = 80 · 3+3', groups: [3, 3], pulseMs: 250 },
  { id: '8/8', title: '8/8', sub: 'Eighth = 240 · 3+3+2', groups: [3, 3, 2], pulseMs: 250 },
] as const;
export type MetronomeRhythm = typeof METRONOME_RHYTHMS[number]['id'];
export function metronomePlan(id: string) {
  const rhythm = METRONOME_RHYTHMS.find(r => r.id === id) ?? METRONOME_RHYTHMS[0];
  const pulses = rhythm.groups.reduce<number>((sum, n) => sum + n, 0);
  const barMs = pulses * rhythm.pulseMs;
  const accents = new Set<number>();
  let offset = 0;
  rhythm.groups.forEach(n => { accents.add(offset); offset += n; });
  return {
    rhythm, audibleMs: 4 * barMs, targetMs: 8 * barMs,
    ticks: Array.from({ length: 4 * pulses }, (_, i) => ({
      atMs: i * rhythm.pulseMs,
      accent: i % pulses === 0 || (rhythm.groups.length < pulses && accents.has(i % pulses)),
    })),
  };
}
export function metronomeError(elapsedMs: number, plan: ReturnType<typeof metronomePlan>) {
  return Math.round(elapsedMs - plan.targetMs);
}
