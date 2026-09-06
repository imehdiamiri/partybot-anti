import React from 'react';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import type { PartyToolType } from './PartyToolsSection';

/** Object silhouettes, not icon badges. The canvas is always transparent. */
export function ToolIllustration({ tool, color, size = 80 }: { tool: PartyToolType; color: string; size?: number }) {
  const ink = '#111521';
  let object: React.ReactNode;
  switch (tool) {
    case 'dice':
      object = <G rotation={-10} origin="48,48">
        <Rect x="13" y="13" width="70" height="70" rx="17" fill={color} />
        <Path d="M25 19H66" stroke="white" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
        {[[31,31],[65,31],[48,48],[31,65],[65,65]].map(([cx,cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill={ink} />)}
      </G>; break;
    case 'bottle':
      object = <G rotation={16} origin="48,48">
        <Path d="M39 10H57V29C57 36 68 38 68 48V81Q68 88 60 88H36Q28 88 28 81V48C28 38 39 36 39 29Z" fill={color} />
        <Rect x="37" y="7" width="22" height="9" rx="3" fill="#EEF4FF" />
        <Rect x="29" y="52" width="38" height="22" rx="4" fill="#EEF4FF" />
        <Path d="M48 57L54 63L48 69L42 63Z" fill={color} />
        <Path d="M37 46V77" stroke="white" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round" />
      </G>; break;
    case 'hourglass':
      object = <G>
        <Path d="M24 14C24 38 38 39 43 48C38 57 24 58 24 82H72C72 58 58 57 53 48C58 39 72 38 72 14Z" fill={color} fillOpacity=".18" stroke={color} strokeWidth="4" />
        <Path d="M32 28H64L48 45ZM48 56L65 76H31Z" fill={color} />
        <Path d="M48 46V61" stroke={color} strokeWidth="3" />
        <Path d="M20 12H76M20 84H76" stroke="#EEF4FF" strokeWidth="7" strokeLinecap="round" />
      </G>; break;
    case 'coin':
      object = <G>
        <Circle cx="49" cy="50" r="36" fill={color} />
        <Circle cx="47" cy="46" r="30" fill="none" stroke={ink} strokeOpacity=".4" strokeWidth="3" />
        <Path d="M47 25L53 39L68 41L57 51L60 66L47 59L34 66L37 51L26 41L41 39Z" fill={ink} />
        <Path d="M27 21Q46 8 66 23" stroke="white" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
      </G>; break;
    case 'teams':
      object = <G>
        <Circle cx="25" cy="30" r="12" fill={color} />
        <Path d="M7 64V57C7 39 43 39 43 57V64Z" fill={color} />
        <Circle cx="71" cy="30" r="12" fill="#A5C8FF" />
        <Path d="M53 64V57C53 39 89 39 89 57V64Z" fill="#A5C8FF" />
        <Path d="M33 81H63M33 81L39 75M33 81L39 87M63 81L57 75M63 81L57 87" stroke="#EEF4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </G>; break;
    case 'wheel':
      object = <G>
        <Path d="M48 48V12A36 36 0 0 1 79.18 66Z" fill={color} />
        <Path d="M48 48L79.18 66A36 36 0 0 1 16.82 66Z" fill="#64D8D3" />
        <Path d="M48 48L16.82 66A36 36 0 0 1 48 12Z" fill="#FFC269" />
        <Circle cx="48" cy="48" r="36" fill="none" stroke="#EEF4FF" strokeWidth="3" />
        <Circle cx="48" cy="48" r="8" fill={ink} stroke="#EEF4FF" strokeWidth="3" />
        <Path d="M40 5H56L48 22Z" fill="#EEF4FF" />
      </G>; break;
  }
  return <Svg testID={`tool-illustration-${tool}`} width={size} height={size} viewBox="0 0 96 96" accessible={false}>{object}</Svg>;
}
