import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { Colors, platformShadow } from '../theme/Colors';

// Platform-safe BlurView
let BlurView: any = null;
if (Platform.OS === 'ios') {
  try { BlurView = require('expo-blur').BlurView; } catch {}
}

interface SurfaceCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const SurfaceCard = ({ children, style }: SurfaceCardProps) => {
  if (Platform.OS === 'ios' && BlurView) {
    return (
      <BlurView tint="dark" intensity={40} style={[styles.surfaceCard, style]}>
        {children}
      </BlurView>
    );
  }
  
  return (
    <View style={[styles.surfaceCard, styles.androidSurface, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  surfaceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    ...platformShadow(6, '#000', 0.2, 10),
  },
  androidSurface: {
    backgroundColor: Colors.surface2,
  },
});
