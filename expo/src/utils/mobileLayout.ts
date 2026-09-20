/** Shared geometry for floating navigation and responsive tool cards. */
export const tabBarBottom = (bottomInset: number) => Math.max(bottomInset, 18);
export const tabContentBottom = (bottomInset: number) => tabBarBottom(bottomInset) + 64 + 24;

export function toolGridColumns(width: number, fontScale: number) {
  return width / Math.max(1, fontScale) < 390 ? 2 : 3;
}

/** Keep the full target inside the arena, including the largest animated tile. */
export function arenaCoordinate(percent: number, extent: number, size: number) {
  const radius = Math.min(size / 2, extent / 2);
  return Math.max(radius, Math.min(extent - radius, extent * percent / 100));
}

export function memoryTileSize(width: number, height: number, cols: number, rows: number, gap = 8) {
  return Math.max(1, Math.min(110, (width - gap * (cols - 1)) / cols, (height - gap * (rows - 1)) / rows));
}
