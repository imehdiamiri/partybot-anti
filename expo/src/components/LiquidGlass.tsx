import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass, platformShadow } from '../theme/Colors';

let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}

type GlassVariant = 'low' | 'mid' | 'high' | 'chrome';

interface LiquidGlassProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: GlassVariant;
  radius?: number;
  /** Adds the lit specular rim — recommended for cards. */
  specular?: boolean;
  /** Tint of the glass (default neutral). */
  tint?: 'dark' | 'light';
  /** Whether to render an outer drop shadow. */
  shadow?: boolean;
  /** Tint color overlay (e.g. brand-tinted glass). Optional. */
  tintColor?: string;
}

/**
 * LiquidGlass: a unified frosted surface primitive.
 * - iOS: real BlurView + translucent fill + specular rim (true Liquid Glass).
 * - Android: tonal Material 3 surface with a subtle inner sheen and elevation.
 */
export function LiquidGlass({
  children,
  style,
  variant = 'mid',
  radius = Glass.radiusMd,
  specular = true,
  tint = 'dark',
  shadow = true,
  tintColor,
}: LiquidGlassProps) {
  const intensity = {
    low: Glass.intensityLow,
    mid: Glass.intensityMid,
    high: Glass.intensityHigh,
    chrome: Glass.intensityChrome,
  }[variant];

  const fill = {
    low: Glass.fillLow,
    mid: Glass.fillMid,
    high: Glass.fillHigh,
    chrome: Glass.fillHigh,
  }[variant];

  const androidBg = {
    low: Glass.androidLow,
    mid: Glass.androidMid,
    high: Glass.androidHigh,
    chrome: Glass.androidHigh,
  }[variant];

  const shadowStyle = shadow ? platformShadow(8, '#000', 0.35, 16) : null;

  const radiusStyle: ViewStyle = { borderRadius: radius };

  return (
    <View
      style={[
        radiusStyle,
        styles.container,
        shadowStyle as ViewStyle,
        style as ViewStyle,
      ]}
    >
      <View style={[StyleSheet.absoluteFillObject, radiusStyle, { overflow: 'hidden' }]} pointerEvents="none">
        {Platform.OS === 'ios' && BlurView ? (
          <>
            <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
            {tintColor ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
            ) : null}
            {specular ? (
              <LinearGradient
                colors={[Glass.specularTop, 'rgba(255,255,255,0.04)', Glass.specularBottom]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </>
        ) : (
          <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: androidBg }]} />
            {tintColor ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
            ) : null}
            {specular ? (
              <LinearGradient
                colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 0.6 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </>
        )}
      </View>
      {/* Edge stroke (rendered above the blur) */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          radiusStyle,
          {
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: Platform.OS === 'ios' ? Glass.specularTop : Glass.androidEdge,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
});
