import React from 'react';
import { StyleSheet, View } from 'react-native';

interface AppBackgroundViewProps {
  /** Legacy variants now share the same plain dark surface. */
  variant?: 'default' | 'simple';
}

/** Shared backdrop for every screen; deliberately contains no decorative layers. */
export const AppBackgroundView = (_props: AppBackgroundViewProps) => (
  <View testID="app-background" style={styles.background} pointerEvents="none" />
);

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: -1,
    backgroundColor: '#08080F',
  },
});
