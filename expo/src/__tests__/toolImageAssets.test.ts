import fs from 'fs';
import path from 'path';

test('tool images have unique Android drawable names across image formats', () => {
  const referenced = new Set<string>();
  for (const relativeRoot of ['../../app', '../components']) {
    const root = path.join(__dirname, relativeRoot);
    for (const file of fs.readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file)) continue;
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      for (const match of source.matchAll(/require\(['"]@\/assets\/images\/tools\/([^'"]+)['"]\)/g)) {
        referenced.add(match[1]);
      }
    }
  }
  const files = [...referenced].filter(name => /\.(png|webp|jpe?g)$/i.test(name));
  expect(files.length).toBeGreaterThanOrEqual(10);
  // Android drops the extension when resolving resources and Metro normalizes names.
  const resourceNames = files.map(name => path.parse(name).name.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  expect(new Set(resourceNames).size).toBe(files.length);
});

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
  expect(code).toMatch(/minHeight: \d+/);
  expect(code).toContain('flexGrow: 1');
});
