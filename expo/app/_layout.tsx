import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import 'react-native-reanimated';
import { Audio } from '@/src/services/GameAudio';
import {
  useFonts,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { isWeb } from '@/src/utils/platform';
import { ResponsiveWebContainer } from '@/src/components/ResponsiveWebContainer';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialize, currentUser, isInitialized } = useAuthStore();
  const { hasCompletedOnboarding } = useSettingsStore();
  const [settingsReady, setSettingsReady] = useState(useSettingsStore.persist.hasHydrated());
  useEffect(() => {
    const stop = useSettingsStore.persist.onFinishHydration(() => setSettingsReady(true));
    if (useSettingsStore.persist.hasHydrated()) setSettingsReady(true);
    return stop;
  }, []);
  const registered = !!currentUser && !currentUser.isAnonymous && currentUser.uid !== 'guest_local';

  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load unified rounded display font; aliased to legacy 'Viral-*' names so all
  // existing screens render the same chunky rounded face on iOS and Android.
  const [fontsLoaded, fontError] = useFonts({
    'Viral-Black': Fredoka_700Bold,
    'Viral-Bold': Fredoka_600SemiBold,
    'Viral-Regular': Fredoka_500Medium,
    'Fredoka_400Regular': Fredoka_400Regular,
    'Fredoka_500Medium': Fredoka_500Medium,
    'Fredoka_600SemiBold': Fredoka_600SemiBold,
    'Fredoka_700Bold': Fredoka_700Bold,
    ...MaterialIcons.font,
  });

  // Preload sound effects
  useAudioPreload();

  useEffect(() => {
    if (!isWeb) {
      Observability.install();
    }
    const unsubscribe = initialize();

    if (!isWeb) {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
    }
    return unsubscribe;
  }, [initialize]);

  // Bridge Firebase auth → economy listener + RevenueCat configure.
  // Both stores key off the current uid; detach when signing out.
  useEffect(() => {
    if (isWeb) {
      useEconomyStore.getState().attach('guest_local');
      return;
    }

    const uid = currentUser?.uid;
    if (!uid) {
      useEconomyStore.getState().detach();
      usePaywallStore.getState().logOut().catch(() => {});
      return;
    }
    useEconomyStore.getState().attach(uid);
    usePaywallStore.getState().configure(uid);
  }, [currentUser?.uid]);

  // Track app foreground/background for presence + room lifecycle (Native only).
  //
  // CRITICAL: do NOT instantly leaveRoom() on background. A user briefly
  // checking notifications, opening the share sheet, or being interrupted by
  // a phone call should stay in the room. We only treat the session as dead
  // after a 45s grace window so the natural multiplayer reconnect flow
  // (heartbeat + onDisconnect) gets a chance to recover the session.
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isWeb) return;

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


  return (
    <RootErrorBoundary>
      {!isInitialized || !settingsReady || (!fontsLoaded && !fontError && !isWeb) ? (
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      ) : (
        <ResponsiveWebContainer>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false, statusBarStyle: 'light', gestureEnabled: false, fullScreenGestureEnabled: false }}>
              <Stack.Protected guard={!registered && !hasCompletedOnboarding}>
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              </Stack.Protected>
              <Stack.Protected guard={!registered && hasCompletedOnboarding}>
              <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
              </Stack.Protected>
              <Stack.Protected guard={registered}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(tools)" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="purchase-detail" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="team-setup" options={{ headerShown: false }} />
              <Stack.Screen name="game/[id]/setup" />
              <Stack.Screen name="game/[id]/session" />
              <Stack.Screen name="game/[id]/lobby/create" />
              <Stack.Screen name="cards/[categoryId]" />
              <Stack.Screen name="lobby/join" />
              <Stack.Screen name="lobby/[roomCode]" />
              <Stack.Screen name="invite" />
              <Stack.Screen name="play" />
              <Stack.Screen name="+not-found" />
              </Stack.Protected>
            </Stack>
            <StatusBar style="light" />
            <ToastOverlay />
          </ThemeProvider>
        </ResponsiveWebContainer>
      )}
    </RootErrorBoundary>
  );
}
