export interface PathCoord { row: number; col: number }

/** Bounded randomized backtracking: unique neighboring tiles, frequent turns. */
export function generatePath(rows: number, cols: number, targetLength = 8, random = Math.random): PathCoord[] {
  const length = Math.min(rows * cols, Math.max(1, Math.floor(targetLength)));
  if (rows < 1 || cols < 1) return [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  // Touching earlier tiles is allowed; revisiting them is not. The old adjacency
  // exclusion forced long straight corridors and could return a truncated path.
  for (let attempt = 0; attempt < 40; attempt++) {
    let budget = 20000;
    const path: PathCoord[] = [{ row: Math.floor(random() * rows), col: Math.floor(random() * cols) }];
    const used = new Set([path[0].row * cols + path[0].col]);
    const search = (previousDirection: number, run: number, turns: number): boolean => {
      if (--budget < 0) return false;
      if (path.length === length) return turns >= Math.floor((length - 2) * 0.55);
      const current = path[path.length - 1];
      const options = directions.map(([dr, dc], direction) => ({
        row: current.row + dr, col: current.col + dc, direction,
        weight: random() + (direction === previousDirection ? -0.35 : 0),
      })).filter(next => next.row >= 0 && next.row < rows && next.col >= 0 && next.col < cols
        && !used.has(next.row * cols + next.col) && !(next.direction === previousDirection && run >= 2))
        .sort((a, b) => b.weight - a.weight);
      for (const next of options) {
        used.add(next.row * cols + next.col); path.push({ row: next.row, col: next.col });
        if (search(next.direction, next.direction === previousDirection ? run + 1 : 1,
          turns + (previousDirection >= 0 && next.direction !== previousDirection ? 1 : 0))) return true;
        path.pop(); used.delete(next.row * cols + next.col);
      }
      return false;
    };
    if (search(-1, 0, 0)) return path;
  }
  // Guaranteed full-length recovery for degenerate grids/custom oversized input.
  const fallback: PathCoord[] = [];
  for (let row = 0; row < rows; row++) for (let x = 0; x < cols; x++) {
    fallback.push({ row, col: row % 2 ? cols - 1 - x : x });
  }
  if (random() < 0.5) fallback.reverse();
  return fallback.slice(0, length);
}
