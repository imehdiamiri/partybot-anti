import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const doExit = () => {
      isExitingRef.current = true;
      exitActiveSession();
      router.replace('/(tabs)');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Leave Game?\nYour current progress will be lost.')) {
        doExit();
      }
      return;
    }
    Alert.alert(
      'Leave Game?',
      'Your current progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave Game', 
          style: 'destructive',
          onPress: doExit
        }
      ]
    );
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

        <GameSessionRenderer session={activeSession} game={activeSession.game} />
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

  const handleSkip = () => {
    if (!skipHandler) return;
    const msg = skipPlayerName
      ? `Skip ${skipPlayerName}'s turn? They'll get a score of 0.`
      : "Skip this player's turn? They'll get a score of 0.";
    if (Platform.OS === 'web') {
      if (window.confirm(`Skip Turn?\n${msg}`)) {
        skipHandler();
      }
      return;
    }
    Alert.alert(
      'Skip Turn?',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: skipHandler },
      ]
    );
  };

  return (
    <View style={[styles.header, { paddingTop }]}>
      <View style={styles.headerInner}>
        <TouchableOpacity 
          onPress={onExit} 
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
            <Text style={[styles.headerSideText, { color: 'rgba(255,255,255,0.5)' }]}>Skip</Text>
            <IconSymbol name="forward.fill" size={12} color="rgba(255,255,255,0.5)" />
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
    minWidth: 50,
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
