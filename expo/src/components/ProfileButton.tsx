import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SCREEN_LAYOUT } from '@/src/theme/ScreenLayout';

/** One crisp circular toolbar target, with no glass layers or diffuse shadow. */
export function ProfileButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  return <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel="Profile"
    accessibilityHint="Open your profile and settings"
    onPress={onPress}
    android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
  >
    <IconSymbol name="person.crop.circle" size={22} color="#FFFFFF" />
  </Pressable>;
}
const styles = StyleSheet.create({
  button: {
    width: SCREEN_LAYOUT.touchTarget,
    height: SCREEN_LAYOUT.touchTarget,
    minWidth: SCREEN_LAYOUT.touchTarget,
    minHeight: SCREEN_LAYOUT.touchTarget,
    flexShrink: 0,
    borderRadius: SCREEN_LAYOUT.touchTarget / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C202D',
    borderWidth: 1,
    borderColor: '#343A49',
  },
  pressed: { opacity: 0.7 },
});
