import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGameStore } from '@/src/store/useGameStore';
import { GameSessionRenderer } from '@/src/components/games/GameSessionRenderer';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { MultiplayerStatusBanner } from '@/src/components/MultiplayerStatusBanner';
import { GameSkipProvider, useSkipState } from '@/src/contexts/GameSkipContext';

export default function GameSessionScreen() {
  useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { activeSession, exitActiveSession } = useGameStore();

  if (!activeSession) {
    return null;
  }

  const handleExit = () => {
    Alert.alert(
      'Leave Game?',
      'Your current progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave Game', 
          style: 'destructive',
          onPress: () => {
            exitActiveSession();
            router.navigate(`/game/${activeSession.game.id}`);
          }
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
    Alert.alert(
      'Skip Turn?',
      skipPlayerName
        ? `Skip ${skipPlayerName}'s turn? They'll get a score of 0.`
        : "Skip this player's turn? They'll get a score of 0.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: skipHandler },
      ]
    );
  };

  return (
    <View style={[styles.header, { paddingTop }]}>
      <TouchableOpacity 
        onPress={onExit} 
        style={styles.headerSideButton}
      >
        <IconSymbol name="xmark" size={14} color="#007AFF" />
        <Text style={styles.headerSideText}>Exit</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{gameName}</Text>

      {skipHandler ? (
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.headerSideButton}
        >
          <Text style={[styles.headerSideText, { color: 'rgba(255,255,255,0.5)' }]}>Skip</Text>
          <IconSymbol name="forward.fill" size={12} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
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
