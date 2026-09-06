import React from 'react';
import Svg, { Rect, Circle, Ellipse, Path, Line } from 'react-native-svg';

/** Code-native illustrations: fixed viewBox, no emoji/font metrics or bitmap stretch. */
export function DrumIllustration() {
  return <Svg testID="drum-illustration" width={200} height={200} viewBox="0 0 200 200">
    <Ellipse cx="100" cy="174" rx="68" ry="10" fill="#000" opacity={0.25} />
    <Path d="M40 92H160V143C160 179 40 179 40 143Z" fill="#CB246D" />
    <Path d="M48 106L69 157L94 112L119 158L151 105" fill="none" stroke="#FFBE78" strokeWidth="5" strokeLinejoin="round" />
    <Ellipse cx="100" cy="143" rx="60" ry="23" fill="none" stroke="#E7DCEB" strokeWidth="7" />
    <Ellipse cx="100" cy="92" rx="62" ry="32" fill="#EFEAF7" stroke="#B8A6CB" strokeWidth="7" />
    <Ellipse cx="100" cy="92" rx="50" ry="24" fill="#FFF7E6" />
    <Line x1="31" y1="28" x2="91" y2="85" stroke="#FFD397" strokeWidth="10" strokeLinecap="round" />
    <Line x1="169" y1="28" x2="111" y2="85" stroke="#FFD397" strokeWidth="10" strokeLinecap="round" />
    <Circle cx="91" cy="85" r="7" fill="#FFB66D" /><Circle cx="111" cy="85" r="7" fill="#FFB66D" />
  </Svg>;
}

export function PhoneHandoffIllustration({ color }: { color: string }) {
  return <Svg testID="phone-handoff-illustration" width="100%" height={156} viewBox="0 0 272 156" preserveAspectRatio="xMidYMid meet">
    <Circle cx="44" cy="78" r="30" fill="#2A3040" />
    <Circle cx="44" cy="71" r="9" fill="#AAB4C8" />
    <Path d="M27 94C27 77 61 77 61 94" fill="#AAB4C8" />
    <Rect x="95" y="18" width="68" height="120" rx="17" fill="#202838" stroke="#E5EBF5" strokeWidth="3" />
    <Rect x="103" y="35" width="52" height="78" rx="8" fill={color} opacity={0.2} />
    <Line x1="119" y1="26" x2="139" y2="26" stroke="#E5EBF5" strokeWidth="3" strokeLinecap="round" />
    <Circle cx="129" cy="124" r="4" fill="#E5EBF5" />
    <Path d="M116 75H143M134 66L143 75L134 84" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M174 78H195M187 70L195 78L187 86" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="230" cy="78" r="30" fill={color} opacity={0.18} />
    <Circle cx="230" cy="71" r="9" fill={color} />
    <Path d="M213 94C213 77 247 77 247 94" fill={color} />
  </Svg>;
}
