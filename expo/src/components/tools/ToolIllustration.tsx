import React from 'react';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import type { PartyToolType } from './PartyToolsSection';

/** Consistent silver line icons on a transparent canvas. */
export function ToolIllustration({ tool, size = 80 }: { tool: PartyToolType; color?: string; size?: number }) {
  const silver = '#D8DFE8';
  let object: React.ReactNode;
  switch (tool) {
    case 'dice':
      object = <G><Rect x="15" y="15" width="66" height="66" rx="10" />
        {[[31,31],[65,31],[48,48],[31,65],[65,65]].map(([cx,cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill={silver} stroke="none" />)}
      </G>; break;
    case 'bottle':
      object = <G><Path d="M39 17H57V33C57 39 67 41 67 50V81Q67 86 62 86H34Q29 86 29 81V50C29 41 39 39 39 33Z" />
        <Rect x="37" y="8" width="22" height="9" rx="2" /><Path d="M30 53H66M30 72H66M37 43V48" /></G>; break;
    case 'hourglass':
      object = <G><Path d="M25 16C25 37 38 40 44 48C38 56 25 59 25 80H71C71 59 58 56 52 48C58 40 71 37 71 16Z" />
        <Path d="M20 11H76M20 85H76M33 29H63L48 44ZM48 58L62 73H34Z" /></G>; break;
    case 'coin':
      object = <G><Circle cx="48" cy="48" r="34" /><Circle cx="48" cy="48" r="26" strokeOpacity=".45" strokeWidth="2" />
        <Path d="M48 29V67M58 36H43Q35 36 35 43Q35 49 44 49H52Q61 49 61 56Q61 62 53 62H37" /></G>; break;
    case 'teams':
      object = <G><Circle cx="25" cy="29" r="10" /><Circle cx="71" cy="29" r="10" />
        <Path d="M9 64V58C9 40 41 40 41 58V64M55 64V58C55 40 87 40 87 58V64M34 80H62M34 80L40 74M34 80L40 86M62 80L56 74M62 80L56 86" /></G>; break;
    case 'wheel':
      object = <G><Circle cx="48" cy="50" r="34" /><Circle cx="48" cy="50" r="6" />
        <Path d="M48 28V44M54 50H82M48 56V84M14 50H42M24 26L44 46M52 54L72 74M24 74L44 54M52 46L72 26" strokeOpacity=".6" strokeWidth="2" />
        <Path d="M40 6H56L48 21Z" fill={silver} stroke="none" /></G>; break;
  }
  return <Svg testID={`tool-illustration-${tool}`} width={size} height={size} viewBox="0 0 96 96" accessible={false}>
    <G fill="none" stroke={silver} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{object}</G>
  </Svg>;
}
