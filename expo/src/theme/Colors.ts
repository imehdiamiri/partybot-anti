import { Platform } from 'react-native';

/**
 * PartyBot — Unified design tokens
 * iOS: Liquid Glass (translucent stacks on top of mesh background)
 * Android: Material 3 Expressive (elevated tonal surfaces)
 */
export const Colors = {
  black: '#000000',
  white: '#FFFFFF',

  // ─── Brand & accents ───
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  mint: '#66D4CF',
  teal: '#64D2FF',
  pink: '#FF375F',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  cyan: '#32ADE6',
  green: '#30D158',

  // Semantic
  secondary: 'rgba(235, 235, 245, 0.6)',
  tertiary: 'rgba(235, 235, 245, 0.3)',

  // App backgrounds
  appBackground: '#000000',
  whiteOverlay5: 'rgba(255, 255, 255, 0.05)',
  whiteOverlay6: 'rgba(255, 255, 255, 0.06)',
  whiteOverlay8: 'rgba(255, 255, 255, 0.08)',
  whiteOverlay9: 'rgba(255, 255, 255, 0.09)',

  primaryAction: 'rgba(10, 132, 255, 0.88)',
  blueOverlay14: 'rgba(10, 132, 255, 0.14)',

  // ─── Liquid Glass (iOS) / Material 3 tonal (Android) surfaces ───
  surface1: Platform.OS === 'android' ? '#14141C' : 'rgba(255, 255, 255, 0.05)',
  surface2: Platform.OS === 'android' ? '#1A1A24' : 'rgba(255, 255, 255, 0.07)',
  surface3: Platform.OS === 'android' ? '#22222E' : 'rgba(255, 255, 255, 0.09)',
  surfaceBorder: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.10)',

  // Glass-specific
  glassHighlight: 'rgba(255, 255, 255, 0.18)',
  glassEdge: 'rgba(255, 255, 255, 0.22)',
  glassEdgeSoft: 'rgba(255, 255, 255, 0.08)',
};

/**
 * Liquid glass tokens used by the LiquidGlass component and other surfaces.
 */
export const Glass = {
  // iOS BlurView intensities
  intensityLow: 30,
  intensityMid: 55,
  intensityHigh: 85,
  intensityChrome: 95,

  // Layer fills (sit on top of the blur to create the "frosted glass" tone)
  fillLow: 'rgba(255, 255, 255, 0.04)',
  fillMid: 'rgba(255, 255, 255, 0.07)',
  fillHigh: 'rgba(255, 255, 255, 0.10)',

  // Specular edge gradient — gives the glass its lit rim
  specularTop: 'rgba(255, 255, 255, 0.22)',
  specularBottom: 'rgba(255, 255, 255, 0.02)',

  // Android tonal surfaces (Material 3 inspired)
  androidLow: '#13131B',
  androidMid: '#1A1A24',
  androidHigh: '#22222E',
  androidEdge: 'rgba(255, 255, 255, 0.07)',

  // Radii
  radiusSm: 14,
  radiusMd: 20,
  radiusLg: 28,
  radiusXl: 36,
};

export const Typography = {
  viralTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 20,
  },
  largeTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 32,
    letterSpacing: -0.5,
  },
};

/**
 * Cross-platform shadow helper.
 */
export function platformShadow(
  elevation: number = 6,
  color: string = '#000',
  opacity: number = 0.3,
  radius: number = 10
) {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: Math.max(2, elevation * 0.6) },
      shadowOpacity: opacity,
      shadowRadius: radius,
    };
  }
  return {
    elevation,
  };
}
