import { createElement } from 'react';
import { Platform } from 'react-native';

// CSS owns web sizing from the first HTML paint. Do not hydrate server-estimated
// card widths with client window measurements: React can retain the stale styles.
export const GAME_LIBRARY_CSS = `
[data-testid="games-grid"] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
[data-testid="games-grid"] > div { min-width: 0; }
@media (min-width: 612px) {
  [data-testid="games-grid"] { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
}
@media (min-width: 992px) {
  [data-testid="games-grid"] { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
}
`;

export function GameLibraryWebStyles() {
  return Platform.OS === 'web' ? createElement('style', null, GAME_LIBRARY_CSS) : null;
}
