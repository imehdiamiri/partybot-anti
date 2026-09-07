import React from 'react';
import { Image } from 'react-native';
import type { PartyToolType } from './PartyToolsSection';
const sources = {
  dice: require('@/assets/images/tools/dice.png'),
  bottle: require('@/assets/images/tools/bottle.png'),
  hourglass: require('@/assets/images/tools/hourglass.png'),
  coin: require('@/assets/images/tools/coin.png'),
  teams: require('@/assets/images/tools/teams.png'),
  wheel: require('@/assets/images/tools/wheel.png'),
};
/** Bundled RGBA cutouts: identical assets on web, iOS and Android. */
export function ToolIllustration({ tool, size = 68 }: { tool: PartyToolType; color?: string; size?: number }) {
  return <Image testID={`tool-illustration-${tool}`} source={sources[tool]}
    style={{ width: size, height: size }} resizeMode="contain" accessible={false} fadeDuration={0} />;
}
