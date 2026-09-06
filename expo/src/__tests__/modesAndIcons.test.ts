import fs from 'fs';
import path from 'path';
import { GameLibrary, GameMode, GameModeDetails } from '../models/AppModels';

const source = (file: string) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('only single-phone and individual multi-phone modes are available', () => {
  expect(Object.values(GameMode)).toEqual(['singleDevice', 'multiDevice']);
  expect(Object.keys(GameModeDetails)).toEqual(Object.values(GameMode));
  for (const game of GameLibrary) {
    expect(game.supportedModes.length).toBeGreaterThan(0);
    for (const mode of game.supportedModes) expect(Object.values(GameMode)).toContain(mode);
  }
});

test('retired team setup only redirects; it cannot create or start a room', () => {
  const route = source('app/team-setup.tsx');
  expect(route).toContain('<Redirect href="/" />');
  expect(route).not.toMatch(/useMultiplayerStore|startGame|Team Mode/);
});

test('web icons use the public component whose font is preloaded by the root', () => {
  const icon = source('components/ui/icon-symbol.tsx');
  expect(icon).toContain("import MaterialIcons from '@expo/vector-icons/MaterialIcons'");
  expect(icon).toContain('<MaterialIcons ');
  expect(icon).not.toContain('createIconSet');
  expect(source('app/_layout.tsx')).toContain('...MaterialIcons.font');
});

test('all declared symbol mappings resolve to actual Material glyphs', () => {
  const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
  const mapping = source('components/ui/icon-symbol.tsx').split('const MAPPING = {')[1].split('} as unknown')[0];
  const entries = [...mapping.matchAll(/'[^']+':\s*'([^']+)'/g)];
  expect(entries.length).toBeGreaterThan(50);
  for (const [, glyph] of entries) expect(glyphs).toHaveProperty(glyph);
});

test('font placeholders remain stable during nested web hydration', () => {
  const icon = source('components/ui/icon-symbol.tsx');
  expect(icon).toContain('const serverSnapshot = () => false');
  expect(icon).toContain('const clientSnapshot = () => true');
  expect(icon).toContain('useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)');
  expect(icon).toContain('width: size, height: size, flexShrink: 0');
  expect(icon.indexOf('if (!hydrated) return <Text style=')).toBeLessThan(icon.indexOf('return <MaterialIcons'));
});

test('app symbol literals do not silently fall back to a question mark', () => {
  const icon = source('components/ui/icon-symbol.tsx');
  const scan = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory() && item.name !== '__tests__') scan(file);
      else if (item.isFile() && /\.tsx?$/.test(file)) {
        const text = fs.readFileSync(file, 'utf8');
        const literals = [...text.matchAll(/["']([a-z0-9]+(?:\.[a-z0-9]+)*\.fill)["']/g)];
        const names = [...text.matchAll(/<IconSymbol[^>]*?\bname="([a-z0-9.]+)"/gs)];
        const configured = [...text.matchAll(/\bicon:\s*["']([a-z0-9.]+)["']/g)];
        for (const [, name] of [...literals, ...names, ...configured]) {
          expect(icon).toContain(`'${name}':`);
        }
      }
    }
  };
  scan(path.join(__dirname, '..'));
  scan(path.join(__dirname, '../../app'));
});
