import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import 'react-native-reanimated';
import {
  useFonts,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useEconomyStore } from '@/src/store/useEconomyStore';
import { usePaywallStore } from '@/src/store/usePaywallStore';
import { useAudioPreload } from '@/src/hooks/useAudioPreload';
import { ToastOverlay } from '@/src/components/ToastOverlay';
import { RootErrorBoundary } from '@/src/components/ErrorBoundary';
import { setUserOnline, setUserOffline } from '@/src/lib/firebase';
import { Observability } from '@/src/services/Observability';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialize, currentUser, isInitialized, signInAnonymously } = useAuthStore();
  const { hasCompletedOnboarding } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  const [isMounted, setIsMounted] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load unified rounded display font; aliased to legacy 'Viral-*' names so all
  // existing screens render the same chunky rounded face on iOS and Android.
  const [fontsLoaded] = useFonts({
    'Viral-Black': Fredoka_700Bold,
    'Viral-Bold': Fredoka_600SemiBold,
    'Viral-Regular': Fredoka_500Medium,
    'Fredoka_400Regular': Fredoka_400Regular,
    'Fredoka_500Medium': Fredoka_500Medium,
    'Fredoka_600SemiBold': Fredoka_600SemiBold,
    'Fredoka_700Bold': Fredoka_700Bold,
  });

  // Preload sound effects
  useAudioPreload();

  useEffect(() => {
    setIsMounted(true);
    Observability.install();
    initialize();
  }, [initialize]);

  // Bridge Firebase auth → economy listener + RevenueCat configure.
  // Both stores key off the current uid; detach when signing out.
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      useEconomyStore.getState().detach();
      return;
    }
    useEconomyStore.getState().attach(uid);
    usePaywallStore.getState().configure(uid);
  }, [currentUser?.uid]);

  // Track app foreground/background for presence + room lifecycle.
  //
  // CRITICAL: do NOT instantly leaveRoom() on background. A user briefly
  // checking notifications, opening the share sheet, or being interrupted by
  // a phone call should stay in the room. We only treat the session as dead
  // after a 45s grace window so the natural multiplayer reconnect flow
  // (heartbeat + onDisconnect) gets a chance to recover the session.
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const BACKGROUND_GRACE_MS = 45_000;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const uid = currentUser?.uid;
      if (!uid) return;

      const wasBackgrounded = appState.current.match(/inactive|background/);
      const goingBackground = nextState.match(/inactive|background/);

      if (wasBackgrounded && nextState === 'active') {
        // Foreground: cancel pending leave, refresh presence.
        if (backgroundTimer.current) {
          clearTimeout(backgroundTimer.current);
          backgroundTimer.current = null;
        }
        setUserOnline(uid);
      } else if (goingBackground) {
        setUserOffline(uid);
        // Schedule a deferred leave after the grace window. If the user
        // returns before then we cancel it above. If they don't, we tear
        // the session down so we don't leak heartbeats + listeners.
        if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
        backgroundTimer.current = setTimeout(() => {
          backgroundTimer.current = null;
          const mp = useMultiplayerStore.getState();
          if (mp.roomCode) mp.leaveRoom().catch(() => {});
        }, BACKGROUND_GRACE_MS);
      }
      appState.current = nextState;
    });
    return () => {
      subscription.remove();
      if (backgroundTimer.current) {
        clearTimeout(backgroundTimer.current);
        backgroundTimer.current = null;
      }
    };
  }, [currentUser?.uid]);

  // Track whether onboarding has been shown THIS session (app launch).
  // This prevents the infinite redirect loop while still showing onboarding
  // every time the app is opened fresh.
  const onboardingShownThisSession = useRef(false);

  useEffect(() => {
    if (!isMounted || !navigationState?.key || !isInitialized) return;

    const inOnboarding = segments[0] === 'onboarding';

    const timer = setTimeout(() => {
      // Show onboarding once per session on fresh app open.
      // The onboarding screen itself handles navigation to (tabs) when the
      // user completes it — we never redirect AWAY from onboarding here.
      if (!inOnboarding && !onboardingShownThisSession.current) {
        onboardingShownThisSession.current = true;
        router.replace('/onboarding');
        return;
      }

      if (inOnboarding) {
        onboardingShownThisSession.current = true;
      }

      // Auto-create an anonymous session so the user can start playing
      // offline immediately once they leave onboarding.
      if (!inOnboarding && !currentUser) {
        signInAnonymously().catch(() => {});
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [currentUser, isInitialized, segments, navigationState?.key, isMounted]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  }

  return (
    <RootErrorBoundary>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tools)" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="purchase-detail" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="team-setup" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <ToastOverlay />
    </ThemeProvider>
    </RootErrorBoundary>
  );
}
