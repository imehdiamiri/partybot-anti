import fs from 'fs';
import path from 'path';
import { GAME_LIBRARY_CSS } from '../components/GameLibraryWebStyles';

test('web grid is responsive in the exported HTML without measuring the viewport', () => {
  expect(GAME_LIBRARY_CSS).toContain('display: grid');
  for (const columns of [2, 3, 4]) {
    expect(GAME_LIBRARY_CSS).toContain(`repeat(${columns}, minmax(0, 1fr))`);
  }
  const source = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/index.tsx'), 'utf8');
  expect(source).toContain('<GameLibraryWebStyles />');
  expect(source).toContain("Platform.OS === 'web' ? undefined : { width: columnWidth }");
  expect(source).toContain("if (Platform.OS === 'web') return;");
});

test('all 16 game heroes have a generated asset and a recorded prompt', () => {
  const root = path.join(__dirname, '../../..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/hero-prompts-2026-09-06.json'), 'utf8'));
  expect(manifest.assets).toHaveLength(16);
  expect(new Set(manifest.assets.map((a: any) => a.asset)).size).toBe(16);
  const model = fs.readFileSync(path.join(root, 'expo/src/models/AppModels.ts'), 'utf8');
  for (const asset of manifest.assets) {
    expect(asset.prompt.length).toBeGreaterThan(100);
    expect(model).toContain(`/heroes/${asset.id}.webp`);
    const bytes = fs.readFileSync(path.join(root, asset.asset));
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    expect(bytes.length).toBeLessThan(300000);
  }
});
