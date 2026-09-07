import fs from 'fs';
import path from 'path';

test.each(['dice','bottle','hourglass','coin','teams','wheel'])('%s is a small bundled RGBA PNG on every platform', name => {
  const bytes = fs.readFileSync(path.join(__dirname, '../../assets/images/tools', `${name}.png`));
  expect(bytes.readUInt32BE(16)).toBe(256);
  expect(bytes.readUInt32BE(20)).toBe(256);
  expect(bytes[25]).toBe(6);
  expect(bytes.length).toBeLessThan(100000);
});

test('tool cards avoid percentage height in a wrapped native flex grid', () => {
  const code = fs.readFileSync(path.join(__dirname, '../components/tools/PartyToolsSection.tsx'),'utf8');
  expect(code).not.toContain("height: '100%'");
  expect(code).toContain('minHeight: 146');
});
