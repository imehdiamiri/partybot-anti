import React, { useEffect } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  /** Unique key — change it to trigger the animation */
  phaseKey: string;
  /** Animation style: 'fade' | 'slideUp' | 'scale' */
  type?: 'fade' | 'slideUp' | 'scale';
  /** Duration in ms */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * PhaseTransition — wraps game phase content with smooth enter animation.
 * Changes to `phaseKey` trigger a re-animation. Runs on the UI thread via Reanimated.
 */
export function PhaseTransition({ children, phaseKey, type = 'fade', duration = 300, style }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(type === 'slideUp' ? 30 : 0);
  const scale = useSharedValue(type === 'scale' ? 0.92 : 1);

  useEffect(() => {
    opacity.value = 0;
    if (type === 'slideUp') translateY.value = 30;
    if (type === 'scale') scale.value = 0.92;

    opacity.value = withTiming(1, { duration });
    if (type === 'slideUp') translateY.value = withSpring(0, { damping: 14, stiffness: 110 });
    if (type === 'scale') scale.value = withSpring(1, { damping: 12, stiffness: 130 });
  }, [phaseKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      ...(type === 'slideUp' ? [{ translateY: translateY.value }] : []),
      ...(type === 'scale' ? [{ scale: scale.value }] : []),
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
