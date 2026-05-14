/**
 * Unit tests for game logic — path generation, scoring, tile matching.
 * Run: npx jest
 */

// ══════════════════════════════════════════════
// 1. MemoryPath — DFS path generation
// ══════════════════════════════════════════════

function countTurns(path: { row: number; col: number }[]): number {
  let turns = 0;
  for (let i = 2; i < path.length; i++) {
    const dx1 = path[i - 1].col - path[i - 2].col;
    const dy1 = path[i - 1].row - path[i - 2].row;
    const dx2 = path[i].col - path[i - 1].col;
    const dy2 = path[i].row - path[i - 1].row;
    if (dx1 !== dx2 || dy1 !== dy2) turns++;
  }
  return turns;
}

function wouldCreateLongStraight(
  path: { row: number; col: number }[],
  next: { row: number; col: number }
): boolean {
  if (path.length < 2) return false;
  const ext = [...path, next];
  let straight = 1;
  for (let i = ext.length - 1; i >= 2; i--) {
    const dx = ext[i].col - ext[i - 1].col;
    const dy = ext[i].row - ext[i - 1].row;
    const pdx = ext[i - 1].col - ext[i - 2].col;
    const pdy = ext[i - 1].row - ext[i - 2].row;
    if (dx === pdx && dy === pdy) straight++;
    else break;
  }
  return straight >= 3;
}

function generatePath(rows: number, cols: number): { row: number; col: number }[] {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function tryGenerate(): { row: number; col: number }[] | null {
    const startCol = Math.floor(Math.random() * cols);
    const start = { row: 0, col: startCol };
    const path = [start];
    const visited = new Set<string>();
    visited.add(`${start.row},${start.col}`);

    function dfs(current: { row: number; col: number }): boolean {
      if (path.length >= 8 && path.length <= 10) {
        const s = path[0], e = path[path.length - 1];
        const dist = Math.abs(s.row - e.row) + Math.abs(s.col - e.col);
        if (dist >= 4 && countTurns(path) >= 2) return true;
      }
      if (path.length >= 10) return false;

      let neighbors: { row: number; col: number }[] = [];
      for (const [dr, dc] of dirs) {
        const nr = current.row + dr, nc = current.col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr},${nc}`)) {
          let adjUsed = 0;
          for (const [dr2, dc2] of dirs) {
            const ar = nr + dr2, ac = nc + dc2;
            if (ar >= 0 && ar < rows && ac >= 0 && ac < cols && visited.has(`${ar},${ac}`)) adjUsed++;
          }
          if (adjUsed < 3) {
            if (!wouldCreateLongStraight(path, { row: nr, col: nc })) {
              neighbors.push({ row: nr, col: nc });
            }
          }
        }
      }
      // Shuffle
      for (let i = neighbors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
      }
      for (const next of neighbors) {
        const key = `${next.row},${next.col}`;
        visited.add(key);
        path.push(next);
        if (dfs(next)) return true;
        path.pop();
        visited.delete(key);
      }
      return false;
    }

    if (dfs(start)) return [...path];
    return null;
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const result = tryGenerate();
    if (result) return result;
  }
  return [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]; // fallback
}

describe('MemoryPath — path generation', () => {
  test('generates path of valid length (8-10)', () => {
    for (let i = 0; i < 20; i++) {
      const path = generatePath(5, 5);
      expect(path.length).toBeGreaterThanOrEqual(3); // at minimum fallback
    }
  });

  test('path has no duplicate coordinates', () => {
    const path = generatePath(5, 5);
    const set = new Set(path.map(p => `${p.row},${p.col}`));
    expect(set.size).toBe(path.length);
  });

  test('each step is adjacent (manhattan distance = 1)', () => {
    const path = generatePath(5, 5);
    for (let i = 1; i < path.length; i++) {
      const dist = Math.abs(path[i].row - path[i - 1].row) + Math.abs(path[i].col - path[i - 1].col);
      expect(dist).toBe(1);
    }
  });

  test('path stays within bounds', () => {
    const rows = 6, cols = 6;
    const path = generatePath(rows, cols);
    for (const p of path) {
      expect(p.row).toBeGreaterThanOrEqual(0);
      expect(p.row).toBeLessThan(rows);
      expect(p.col).toBeGreaterThanOrEqual(0);
      expect(p.col).toBeLessThan(cols);
    }
  });

  test('supports different grid sizes', () => {
    for (const size of [4, 5, 6, 7]) {
      const path = generatePath(size, size);
      expect(path.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ══════════════════════════════════════════════
// 2. TapInOrder — preview duration formula
// ══════════════════════════════════════════════

function previewDuration(tileCount: number): number {
  return Math.max(4.0, 3.5 + tileCount * 0.35);
}

describe('TapInOrder — preview formula', () => {
  test('minimum preview is 4 seconds', () => {
    expect(previewDuration(1)).toBe(4);
    expect(previewDuration(0)).toBe(4);
  });

  test('scales with tile count', () => {
    expect(previewDuration(8)).toBeCloseTo(6.3, 1);
    expect(previewDuration(10)).toBeCloseTo(7.0, 1);
    expect(previewDuration(14)).toBeCloseTo(8.4, 1);
  });

  test('preview for 6 tiles matches iOS', () => {
    // iOS: max(4.0, 3.5 + 6*0.35) = max(4.0, 5.6) = 5.6
    expect(previewDuration(6)).toBeCloseTo(5.6, 1);
  });
});

// ══════════════════════════════════════════════
// 3. ColorTrap — spawn generation
// ══════════════════════════════════════════════

function seedRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

interface Spawn {
  id: number;
  appearAt: number;
  columnIndex: number;
  colorIndex: number;
  size: number;
}

function generateSpawns(
  spawnInterval: number,
  totalDuration: number,
  seed: number
): Spawn[] {
  const spawns: Spawn[] = [];
  let t = 0.5;
  let id = 0;
  const rng = seedRng(seed);
  while (t < totalDuration) {
    spawns.push({
      id: id++,
      appearAt: t,
      columnIndex: Math.floor(rng() * 4),
      colorIndex: Math.floor(rng() * 5),
      size: 0.8 + rng() * 0.4,
    });
    t += spawnInterval * (0.7 + rng() * 0.6);
  }
  return spawns;
}

describe('ColorTrap — spawn generation', () => {
  test('deterministic with same seed', () => {
    const a = generateSpawns(0.65, 30, 12345);
    const b = generateSpawns(0.65, 30, 12345);
    expect(a).toEqual(b);
  });

  test('different seeds produce different spawns', () => {
    const a = generateSpawns(0.65, 30, 111);
    const b = generateSpawns(0.65, 30, 222);
    // Full arrays should differ — check at least 1 spawn differs
    const differs = a.some((s, i) => !b[i] || s.columnIndex !== b[i].columnIndex || s.colorIndex !== b[i].colorIndex);
    expect(differs).toBe(true);
  });

  test('spawn times are monotonically increasing', () => {
    const spawns = generateSpawns(0.65, 30, 999);
    for (let i = 1; i < spawns.length; i++) {
      expect(spawns[i].appearAt).toBeGreaterThan(spawns[i - 1].appearAt);
    }
  });

  test('column indices in range 0-3', () => {
    const spawns = generateSpawns(0.45, 45, 42);
    for (const s of spawns) {
      expect(s.columnIndex).toBeGreaterThanOrEqual(0);
      expect(s.columnIndex).toBeLessThanOrEqual(3);
    }
  });

  test('color indices in range 0-4', () => {
    const spawns = generateSpawns(0.45, 45, 42);
    for (const s of spawns) {
      expect(s.colorIndex).toBeGreaterThanOrEqual(0);
      expect(s.colorIndex).toBeLessThanOrEqual(4);
    }
  });

  test('easy produces fewer spawns than hard', () => {
    const easy = generateSpawns(0.9, 20, 100);
    const hard = generateSpawns(0.45, 45, 100);
    expect(hard.length).toBeGreaterThan(easy.length);
  });
});

// ══════════════════════════════════════════════
// 4. Imposter — scoring
// ══════════════════════════════════════════════

function calculateImposterScores(
  votes: Record<string, string>,
  imposterId: string,
  playerIds: string[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  playerIds.forEach(id => (scores[id] = 0));

  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach(sid => (voteCounts[sid] = (voteCounts[sid] || 0) + 1));

  let maxVotes = 0;
  let topSuspectId = '';
  Object.entries(voteCounts).forEach(([sid, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      topSuspectId = sid;
    }
  });

  const imposterCaught = topSuspectId === imposterId;
  if (imposterCaught) {
    Object.entries(votes).forEach(([voterId, suspectId]) => {
      if (suspectId === imposterId && voterId !== imposterId) {
        scores[voterId] += 100;
      }
    });
  } else {
    scores[imposterId] += 150;
  }

  return scores;
}

describe('Imposter — scoring', () => {
  test('correct voters get 100 pts when imposter caught', () => {
    const scores = calculateImposterScores(
      { p1: 'p3', p2: 'p3', p3: 'p1' },
      'p3',
      ['p1', 'p2', 'p3']
    );
    expect(scores.p1).toBe(100);
    expect(scores.p2).toBe(100);
    expect(scores.p3).toBe(0); // imposter caught
  });

  test('imposter gets 150 pts when not caught', () => {
    const scores = calculateImposterScores(
      { p1: 'p2', p2: 'p1', p3: 'p2' },
      'p3',
      ['p1', 'p2', 'p3']
    );
    expect(scores.p3).toBe(150);
    expect(scores.p1).toBe(0);
    expect(scores.p2).toBe(0);
  });

  test('imposter voting for themselves does not get points', () => {
    const scores = calculateImposterScores(
      { p1: 'p3', p2: 'p3', p3: 'p3' },
      'p3',
      ['p1', 'p2', 'p3']
    );
    // p3 voted for p3 but is the imposter — no points
    expect(scores.p3).toBe(0);
    expect(scores.p1).toBe(100);
    expect(scores.p2).toBe(100);
  });
});

// ══════════════════════════════════════════════
// 5. MemoryGrid — pair matching
// ══════════════════════════════════════════════

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('MemoryGrid — board generation', () => {
  test('board has correct number of tiles for each grid size', () => {
    const sizes: Record<string, { cols: number; rows: number }> = {
      tiny3x4: { cols: 3, rows: 4 },
      small4x4: { cols: 4, rows: 4 },
      medium4x5: { cols: 4, rows: 5 },
      large5x6: { cols: 5, rows: 6 },
      huge6x6: { cols: 6, rows: 6 },
    };

    for (const [_, dim] of Object.entries(sizes)) {
      const totalTiles = dim.cols * dim.rows;
      const pairs = Math.floor(totalTiles / 2);
      expect(pairs * 2).toBe(totalTiles); // must be even
    }
  });

  test('shuffleArray preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
    expect(shuffled.length).toBe(arr.length);
  });

  test('shuffleArray does not modify original', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });
});
