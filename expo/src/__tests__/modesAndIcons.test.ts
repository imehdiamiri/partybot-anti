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
