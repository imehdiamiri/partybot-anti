import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, platformShadow } from '@/src/theme/Colors';
import { LiquidGlass } from '@/src/components/LiquidGlass';

const TAB_ITEMS = [
  { name: 'index', label: 'Games', icon: 'gamecontroller.fill', accent: Colors.blue },
  { name: 'tools', label: 'Tools', icon: 'wrench.and.screwdriver.fill', accent: Colors.mint },
  { name: 'friends', label: 'Friends', icon: 'person.2.fill', accent: Colors.pink },
] as const;

function TabIndicator({ focused, color }: { focused: boolean; color: string }) {
  const scale = useSharedValue(focused ? 1 : 0.6);
  const opacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0, { duration: 220 });
    scale.value = withTiming(focused ? 1 : 0.6, { duration: 180 });
  }, [focused, opacity, scale]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleX: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.activeIndicator, { backgroundColor: color }, aStyle]}
    />
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 18) : 18;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View style={[styles.tabBarOuterWrapper, { bottom }]} pointerEvents="box-none">
      <View testID="bottom-tab-bar" style={styles.tabBarContainer} pointerEvents="box-none">
        <LiquidGlass
          variant="chrome"
          radius={32}
          specular
          shadow
          style={styles.tabBarShell}
        >
          <View style={styles.tabBarContent}>
            {state.routes
              .filter((r: any) => TAB_ITEMS.some((t) => t.name === r.name))
              .map((route: any) => {
                const item = TAB_ITEMS.find((t) => t.name === route.name);
                if (!item) return null;
                const realIndex = state.routes.findIndex((r: any) => r.key === route.key);
                const isFocused = state.index === realIndex;
                const { options } = descriptors[route.key];

                const onPress = () => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(
                      isFocused
                        ? Haptics.ImpactFeedbackStyle.Light
                        : Haptics.ImpactFeedbackStyle.Medium
                    );
                  }
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!event.defaultPrevented) {
                    if (route.name === 'index') {
                      navigation.navigate(route.name, { defaultTab: 'Games', resetAt: Date.now().toString() });
                    } else if (!isFocused) {
                      navigation.navigate(route.name);
                    }
                  }
                };

                const tint = isFocused ? item.accent : 'rgba(255,255,255,0.65)';

                return (
                  <Pressable
                    key={route.key}
                    testID={`tab-btn-${route.name}`}
                    onPress={onPress}
                    android_ripple={{
                      color: 'rgba(10,132,255,0.20)',
                      borderless: false,
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isFocused }}
                    accessibilityLabel={options.tabBarAccessibilityLabel ?? item.label}
                    style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
                  >
                    <View style={styles.tabContent}>
                      <IconSymbol size={25} name={item.icon as any} color={tint} />
                      <Text
                        style={[styles.label, { color: tint }]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <TabIndicator focused={isFocused} color={item.accent} />
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </LiquidGlass>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Games' }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuterWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  tabBarContainer: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    height: 64,
    ...platformShadow(18, '#000', 0.5, 28),
  },
  tabBarShell: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabContent: {
    minWidth: 64,
    height: 56,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingBottom: 5,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 22,
    height: 3,
    borderRadius: 2,
  },
  label: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});
