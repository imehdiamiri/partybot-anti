import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SCREEN_LAYOUT, screenLayout } from '@/src/theme/ScreenLayout';
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActionConfirmation } from '@/src/components/ActionConfirmation';
import { GameActivityBanner } from '@/src/components/games/GameActivity';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGameStore, MatchPhase } from '@/src/store/useGameStore';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';
import { GameSessionRenderer } from '@/src/components/games/GameSessionRenderer';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { MultiplayerStatusBanner } from '@/src/components/MultiplayerStatusBanner';
import { GameSkipProvider, useSkipState } from '@/src/contexts/GameSkipContext';
import { resetWebScrollOffsets } from '@/src/components/ResponsiveWebContainer';
import { Games, GameMode } from '@/src/models/AppModels';

export default function GameSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { activeSession, exitActiveSession } = useGameStore();
  const { currentRoom } = useMultiplayerStore();

  const isExitingRef = useRef(false);
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => {
    // A game is left only through its explicit, confirmed Exit action.
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    const unsubscribe = Platform.OS === 'web' ? navigation.addListener('beforeRemove', event => {
      if (!isExitingRef.current && useGameStore.getState().activeSession) event.preventDefault();
    }) : () => {};
    return () => { back.remove(); unsubscribe(); };
  }, [navigation]));

  useEffect(() => {
    if (isExitingRef.current) return;
    if (!activeSession && currentRoom && currentRoom.status === 'playing' && id) {
      const gameKey = Object.keys(Games).find(key => Games[key].id === id);
      if (gameKey) {
        const localId = useMultiplayerStore.getState().localPlayerId;
        const normalizedPlayers = Object.values(currentRoom.players).map(p => ({
          ...p,
          isLocal: p.id === localId,
          isHost: p.id === currentRoom.hostId,
        }));

        useGameStore.setState({
          activeSession: {
            id: currentRoom.roomCode,
            game: Games[gameKey],
            mode: GameMode.multiDevice,
            roomCode: currentRoom.roomCode,
            players: normalizedPlayers,
            currentRoundIndex: 0,
            phase: MatchPhase.playing,
            maxRounds: 1,
          }
        });
        return;
      }
    }
    if (!activeSession && id) {
      const gameKey = Object.keys(Games).find(key => Games[key].id === id);
      if (gameKey) {
        router.replace(`/game/${id}/setup?mode=singleDevice` as any);
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [activeSession, currentRoom, id]);

  useEffect(() => {
    resetWebScrollOffsets();
    const raf = requestAnimationFrame(() => resetWebScrollOffsets());
    return () => cancelAnimationFrame(raf);
  }, [id, activeSession?.id]);

  if (!activeSession) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <AppBackgroundView />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  const handleExit = () => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    exitActiveSession();
    router.replace('/(tabs)');
  };

  return (
    <GameSkipProvider>
      <View style={[styles.container, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <AppBackgroundView />
        <MultiplayerStatusBanner />

        {/* Header */}
        <SessionHeader
          gameName={activeSession.game.name}
          onExit={handleExit}
        />

        <GameSessionRenderer key={activeSession.id} session={activeSession} game={activeSession.game} />
      </View>
    </GameSkipProvider>
  );
}

function SessionHeader({ gameName, onExit }: {
  gameName: string;
  onExit: () => void;
}) {
  const { skipHandler, skipPlayerName, skipLabel } = useSkipState();

  const { ask, dismiss, dialog } = useActionConfirmation();
  const pendingSkip = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (pendingSkip.current && pendingSkip.current !== skipHandler) {
      pendingSkip.current = null;
      dismiss();
    }
  }, [skipHandler]);
  const handleSkip = () => {
    if (!skipHandler) return;
    const handler = skipHandler;
    pendingSkip.current = handler;
    ask({ title: 'Skip turn?', message: `Skip ${skipPlayerName || 'this player'}'s current turn? This follows the game's skip rules.`, label: 'Skip turn', run: () => {
      if (pendingSkip.current !== handler) return;
      pendingSkip.current = null;
      return handler();
    }});
  };
  const confirmExit = () => {
    pendingSkip.current = null;
    ask({title: 'Leave game?', message: 'Your current game progress will be lost.', label: 'Leave game', run: onExit});
  };

  return (
    <View style={styles.header}>
      {dialog}
      <ScreenHeader title={gameName} leftLabel="Exit" leftIcon="xmark"
        leftTestID="session-exit-button" onLeftPress={confirmExit}
        rightLabel={skipHandler ? 'Skip' : undefined} rightIcon={skipHandler ? 'forward.fill' : undefined}
        rightTestID="session-skip-button" onRightPress={skipHandler ? handleSkip : undefined}
        rightAccessibilityLabel={skipLabel}
        rightColor="#CFD5E3" />
      <View style={[screenLayout.frame, { maxWidth: SCREEN_LAYOUT.content }]}><GameActivityBanner /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    paddingBottom: 10,
    zIndex: 10,
  },
});
