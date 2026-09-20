import { arenaCoordinate, memoryTileSize, tabBarBottom, tabContentBottom, toolGridColumns } from '../utils/mobileLayout';

test.each([0, 24, 34, 48])('navigation clears the system inset %s', inset => {
  expect(tabBarBottom(inset)).toBeGreaterThanOrEqual(inset);
  expect(tabContentBottom(inset) - tabBarBottom(inset)).toBeGreaterThanOrEqual(64 + 16);
});

test('narrow phones and enlarged text get readable tool cards', () => {
  expect(toolGridColumns(320, 1)).toBe(2);
  expect(toolGridColumns(430, 1.3)).toBe(2);
  expect(toolGridColumns(430, 1)).toBe(3);
});

test.each([[320, 568], [375, 667], [390, 844], [768, 1024]])('all memory grid sizes fit a %sx%s device', (width, height) => {
  for (const [cols, rows] of [[3, 4], [4, 4], [4, 5], [5, 6], [6, 6]]) {
    const availableWidth = width - 48;
    const availableHeight = height - 260;
    const tile = memoryTileSize(availableWidth, availableHeight, cols, rows);
    expect(tile * cols + 8 * (cols - 1)).toBeLessThanOrEqual(availableWidth + 0.001);
    expect(tile * rows + 8 * (rows - 1)).toBeLessThanOrEqual(availableHeight + 0.001);
  }
});

test('largest Color Trap targets remain entirely tappable at every spawn edge', () => {
  for (const extent of [160, 280, 540]) {
    const size = extent * 0.2 * 1.15;
    for (const percent of [5, 10, 50, 90, 95]) {
      const position = arenaCoordinate(percent, extent, size);
      expect(position - size / 2).toBeGreaterThanOrEqual(0);
      expect(position + size / 2).toBeLessThanOrEqual(extent);
    }
  }
});
