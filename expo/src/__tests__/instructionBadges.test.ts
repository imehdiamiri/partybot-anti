import fs from 'fs';
import path from 'path';

const detail = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/game/[id].tsx'), 'utf8');

test('every instruction accent supports a valid translucent hex background', () => {
  const palette = detail.split('const getAccentColor =')[1].split('const isLocked')[0];
  const colors = [...palette.matchAll(/return '([^']+)'/g)].map(match => match[1]);
  expect(colors).toHaveLength(8);
  for (const color of colors) expect(color + '22').toMatch(/^#[0-9a-f]{8}$/i);
});

test('instruction numbers have independent contrast and cannot shrink out of view', () => {
  expect(detail).toContain('<Text style={styles.stepBadgeText}>{i + 1}</Text>');
  const badge = detail.split('stepBadge: {')[1].split('stepBadgeText: {')[0];
  const number = detail.split('stepBadgeText: {')[1].split('instructionText: {')[0];
  expect(badge).toContain('flexShrink: 0');
  expect(number).toContain("color: '#FFFFFF'");
});
