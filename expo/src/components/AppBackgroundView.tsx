import React from 'react';
import { Dimensions, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AppBackgroundViewProps {
  /** 'default' = colorful blobs, 'simple' = clean dark gradient */
  variant?: 'default' | 'simple';
}

export const AppBackgroundView = ({ variant = 'default' }: AppBackgroundViewProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const width = windowWidth;
  const height = windowHeight;
  if (variant === 'simple') {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none">
        {/* Deep base */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080F' }]} />

        {/* Subtle top-to-bottom gradient */}
        <LinearGradient
          colors={['rgba(30, 30, 50, 0.6)', 'rgba(8, 8, 15, 1)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Very faint diagonal sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.025)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  const blobs = [
    {
      color: 'rgba(122, 81, 245, 0.45)', // violet
      width: '95%',
      top: '-25%',
      left: '-20%',
    },
    {
      color: 'rgba(10, 132, 255, 0.38)', // blue
      width: '90%',
      top: '18%',
      left: '45%',
    },
    {
      color: 'rgba(255, 55, 95, 0.28)', // pink
      width: '80%',
      top: '55%',
      left: '-30%',
    },
    {
      color: 'rgba(102, 212, 207, 0.18)', // mint
      width: '70%',
      top: '70%',
      left: '50%',
    },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none">
      {/* Deep base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#05050A' }]} />

      {/* Color blobs (rendered as soft circles).
          On iOS these will be sampled by overlying BlurView surfaces. */}
      {blobs.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: b.top as any,
            left: b.left as any,
            width: b.width as any,
            aspectRatio: 1,
            borderRadius: 9999,
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
        style={StyleSheet.absoluteFill}
      />

      {/* Vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Grain-like fine overlay (extremely subtle) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(255,255,255,0.012)' },
        ]}
      />
    </View>
  );
};
