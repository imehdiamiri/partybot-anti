import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';

export default function JoinLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { joinRoom, isBusy } = useMultiplayerStore();
  const [roomCode, setRoomCode] = useState('');
  const globalPlayerName = useSettingsStore(s => s.playerName);
  const [displayName, setDisplayName] = useState(globalPlayerName);
  
  const isJoinDisabled = roomCode.trim().length < 6 || displayName.trim().length < 2 || isBusy;

  const handleJoin = async () => {
    if (isJoinDisabled) return;
    
    try {
      await joinRoom(roomCode.trim(), displayName.trim());
      router.push({
        pathname: `/lobby/[roomCode]`,
        params: { roomCode: roomCode.trim() }
      });
    } catch (err) {
      // Error handled by store/alert
    }
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView variant="simple" />
      
      <Stack.Screen 
        options={{
          title: 'Join Room',
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: 'dark',
          headerTintColor: 'white',
          headerLargeTitle: false,
          headerBackTitle: 'Back',
        }}
      />

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: Platform.OS === 'android' ? insets.top + 60 : 0 }]} 
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Room Code</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="123456"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={roomCode}
              onChangeText={(text) => setRoomCode(text.replace(/[^0-9]/g, '').substring(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={styles.hintText}>Enter the 6-digit room code.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Name</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />
            <Text style={styles.hintText}>Everyone in the room sees this name.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.joinButton, isJoinDisabled && styles.joinButtonDisabled]}
            onPress={handleJoin}
            disabled={isJoinDisabled}
          >
            <Text style={styles.joinButtonText}>{isBusy ? 'Joining...' : 'Join Room'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Viral-Black', fontSize: 20, color: 'white' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 122, 255, 0.35)',
    borderRadius: 18,
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    paddingVertical: 22,
    letterSpacing: 8,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    color: 'white',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 12,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});
