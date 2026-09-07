import React from 'react';
import Svg, { Ellipse, Path } from 'react-native-svg';
/** Single-color catalog vector; gameplay keeps its separate illustration. */
export function DrumIcon({ size = 52, color = 'white' }: { size?: number; color?: string }) {
  return <Svg testID="drum-game-icon" width={size} height={size} viewBox="0 0 64 64" accessible={false}>
    <Path d="M10 30V48C10 61 54 61 54 48V30" fill="none" stroke={color} strokeWidth="4" />
    <Ellipse cx="32" cy="30" rx="22" ry="9" fill="none" stroke={color} strokeWidth="4" />
    <Path d="M13 35L22 53L32 39L42 53L51 35M11 7L29 24M53 7L35 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
