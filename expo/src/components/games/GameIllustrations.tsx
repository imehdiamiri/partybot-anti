import React, { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo, View } from 'react-native';
import Svg, { Rect, Circle, Ellipse, Path, Line } from 'react-native-svg';

/** Code-native illustrations: fixed viewBox, no emoji/font metrics or bitmap stretch. */
export function DrumIllustration({ size = 200 }: { size?: number }) {
  return <Svg testID="drum-illustration" width={size} height={size} viewBox="0 0 200 200">
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
  const movement = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let loop: Animated.CompositeAnimation | undefined;
    const configure = (reduced: boolean) => {
      if (!alive) return;
      loop?.stop();
      movement.setValue(reduced ? 0.5 : 0);
      if (!reduced) {
        loop = Animated.loop(Animated.sequence([
          Animated.timing(movement, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(movement, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(300),
        ]));
        loop.start();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(configure).catch(() => configure(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', configure);
    return () => { alive = false; loop?.stop(); subscription.remove(); };
  }, [movement]);
  return <View testID="phone-handoff-illustration" accessibilityLabel="Pass the phone from your hand to the next player's hand"
    style={{ width: 224, maxWidth: '100%', height: 156 }}>
    <Svg width="100%" height={156} viewBox="0 0 224 156">
      <Path d="M2 142V108L25 78Q33 70 39 77L29 97L58 81Q67 78 69 86L55 113Q50 125 31 132V150"
        fill="#30394D" stroke="#AAB4C8" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M222 142V108L199 78Q191 70 185 77L195 97L166 81Q157 78 155 86L169 113Q174 125 193 132V150"
        fill={color} fillOpacity={0.18} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M91 137H133M124 130L133 137L124 144" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 45, top: 12,
      transform: [{ translateX: movement.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) },
        { rotate: movement.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) }] }}>
      <Svg width={64} height={108} viewBox="0 0 64 108">
        <Rect x="3" y="3" width="58" height="102" rx="14" fill="#202838" stroke="#E5EBF5" strokeWidth="3" />
        <Rect x="10" y="19" width="44" height="65" rx="7" fill={color} opacity={0.22} />
        <Line x1="25" y1="11" x2="39" y2="11" stroke="#E5EBF5" strokeWidth="3" strokeLinecap="round" />
        <Circle cx="32" cy="94" r="3" fill="#E5EBF5" />
      </Svg>
    </Animated.View>
  </View>;
}
