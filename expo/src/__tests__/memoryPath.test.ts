import { generatePath } from '../utils/memoryPath';

test.each([5, 6, 7, 8])('%i square paths keep full length, turn often and never revisit a cell', size => {
  let seed = 237;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const routes = new Set<string>();
  for (const length of [6, 10, 12, 16, 20, Math.floor(size * size / 2)]) for (let i = 0; i < 30; i++) {
    const path = generatePath(size, size, length, random);
    expect(path).toHaveLength(length);
    expect(new Set(path.map(p => `${p.row},${p.col}`)).size).toBe(length);
    let previous = ''; let run = 0; let turns = 0;
    path.forEach((p, index) => {
      expect(p.row >= 0 && p.row < size && p.col >= 0 && p.col < size).toBe(true);
      if (!index) return;
      const dr = p.row - path[index - 1].row, dc = p.col - path[index - 1].col;
      expect(Math.abs(dr) + Math.abs(dc)).toBe(1);
      const direction = `${dr},${dc}`;
      if (previous && direction !== previous) turns++;
      run = direction === previous ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
      previous = direction;
    });
    expect(turns).toBeGreaterThanOrEqual(Math.floor((length - 2) * .55));
    routes.add(JSON.stringify(path));
  }
  expect(routes.size).toBeGreaterThan(130);
});
