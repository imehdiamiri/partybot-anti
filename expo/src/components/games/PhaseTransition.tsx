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
  /** Animation style */
  type?: 'fade' | 'slideUp' | 'slideLeft' | 'scale' | 'pop';
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
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    
    // Initial values based on transition type
    if (type === 'slideUp') {
      translateY.value = 40;
      translateX.value = 0;
      scale.value = 0.98;
    } else if (type === 'slideLeft') {
      translateY.value = 0;
      translateX.value = 50;
      scale.value = 1;
    } else if (type === 'scale') {
      translateY.value = 0;
      translateX.value = 0;
      scale.value = 0.97;
    } else if (type === 'pop') {
      translateY.value = 0;
      translateX.value = 0;
      scale.value = 0.94;
    } else {
      // 'fade' -> modern premium: fade + subtle slide up (no scale to prevent layout pulsing)
      translateY.value = 10;
      translateX.value = 0;
      scale.value = 1;
    }

    // Run animations using premium fluid spring coefficients
    opacity.value = withTiming(1, { duration });
    
    const springConfig = { damping: 26, stiffness: 120 }; // Smooth, no bounce
    
    if (type === 'slideUp') {
      translateY.value = withSpring(0, springConfig);
      scale.value = withTiming(1, { duration });
    } else if (type === 'slideLeft') {
      translateX.value = withSpring(0, springConfig);
    } else if (type === 'scale') {
      scale.value = withSpring(1, { damping: 24, stiffness: 100 });
    } else if (type === 'pop') {
      scale.value = withSpring(1, { damping: 22, stiffness: 110 });
    } else {
      // default: modern premium fade + subtle slide
      translateY.value = withSpring(0, springConfig);
      scale.value = 1;
    }
  }, [phaseKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value }
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
