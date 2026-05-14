import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGameStore } from '@/src/store/useGameStore';
import { GameSessionRenderer } from '@/src/components/games/GameSessionRenderer';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { MultiplayerStatusBanner } from '@/src/components/MultiplayerStatusBanner';

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
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppBackgroundView />
      <MultiplayerStatusBanner />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={handleExit} 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <IconSymbol name="xmark" size={14} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 4 }}>Exit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeSession.game.name}</Text>
        <View style={styles.headerButton} />
      </View>

      <GameSessionRenderer session={activeSession} game={activeSession.game} />
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
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Viral-Black',
    color: 'white',
    fontSize: 17,
  },
});

