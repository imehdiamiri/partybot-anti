import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActionConfirmation } from '@/src/components/ActionConfirmation';
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
      <View style={styles.container}>
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
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppBackgroundView />
        <MultiplayerStatusBanner />

        {/* Header */}
        <SessionHeader
          gameName={activeSession.game.name}
          paddingTop={insets.top + 10}
          onExit={handleExit}
        />

        <GameSessionRenderer key={activeSession.id} session={activeSession} game={activeSession.game} />
      </View>
    </GameSkipProvider>
  );
}

function SessionHeader({ gameName, paddingTop, onExit }: {
  gameName: string;
  paddingTop: number;
  onExit: () => void;
}) {
  const { skipHandler, skipPlayerName } = useSkipState();

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
    <View style={[styles.header, { paddingTop }]}>
      {dialog}
      <View style={styles.headerInner}>
        <TouchableOpacity 
          onPress={confirmExit}
          testID="session-exit-button"
          accessibilityRole="button"
          style={styles.headerSideButton}
        >
          <IconSymbol name="xmark" size={14} color="#007AFF" />
          <Text style={styles.headerSideText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{gameName}</Text>

        {skipHandler ? (
          <TouchableOpacity
            onPress={handleSkip}
            testID="session-skip-button"
            accessibilityRole="button"
            style={styles.headerSideButton}
          >
            <Text style={[styles.headerSideText, { color: '#CFD5E3' }]}>Skip</Text>
            <IconSymbol name="forward.fill" size={18} color="#CFD5E3" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  headerSideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 64,
    minHeight: 44,
  },
  headerSideText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '400',
  },
  headerSpacer: {
    width: 50,
    height: 40,
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    color: 'white',
    fontSize: 17,
  },
});
