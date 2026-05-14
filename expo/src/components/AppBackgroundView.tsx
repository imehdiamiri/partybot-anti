import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface AppBackgroundViewProps {
  /** 'default' = colorful blobs, 'simple' = clean dark gradient */
  variant?: 'default' | 'simple';
}

/**
 * AppBackgroundView
 * A premium ambient backdrop used behind every screen so the Liquid Glass
 * surfaces have something rich to refract.
 *
 * iOS — multi-blob mesh gradient (refracts beautifully through BlurView).
 * Android — layered Material 3 ambient washes (no blur, but tonal depth).
 *
 * variant="simple" — clean dark gradient without blobs (for Auth, Join, etc.)
 */
export const AppBackgroundView = ({ variant = 'default' }: AppBackgroundViewProps) => {
  if (variant === 'simple') {
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: -1 }]} pointerEvents="none">
        {/* Deep base */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#08080F' }]} />

        {/* Subtle top-to-bottom gradient */}
        <LinearGradient
          colors={['rgba(30, 30, 50, 0.6)', 'rgba(8, 8, 15, 1)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Very faint diagonal sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.025)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  const blobs = [
    {
      color: 'rgba(122, 81, 245, 0.45)', // violet
      size: width * 0.95,
      top: -width * 0.25,
      left: -width * 0.2,
    },
    {
      color: 'rgba(10, 132, 255, 0.38)', // blue
      size: width * 0.9,
      top: height * 0.18,
      left: width * 0.45,
    },
    {
      color: 'rgba(255, 55, 95, 0.28)', // pink
      size: width * 0.8,
      top: height * 0.55,
      left: -width * 0.3,
    },
    {
      color: 'rgba(102, 212, 207, 0.18)', // mint
      size: width * 0.7,
      top: height * 0.7,
      left: width * 0.5,
    },
  ];

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: -1 }]} pointerEvents="none">
      {/* Deep base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#05050A' }]} />

      {/* Color blobs (rendered as soft circles).
          On iOS these will be sampled by overlying BlurView surfaces. */}
      {blobs.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: b.color,
            opacity: Platform.OS === 'android' ? 0.55 : 1,
          }}
        />
      ))}

      {/* Diagonal sheen — adds the subtle "lit from above-left" feel */}
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Grain-like fine overlay (extremely subtle) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(255,255,255,0.012)' },
        ]}
      />
    </View>
  );
};
