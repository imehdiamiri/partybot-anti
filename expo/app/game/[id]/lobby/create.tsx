import { Colors } from '@/src/theme/Colors';
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Games } from '@/src/models/AppModels';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';

export default function CreateLobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const gameKey = Object.keys(Games).find(key => Games[key].id === id);
  const game = gameKey ? Games[gameKey] : null;

  const { createRoom, isBusy } = useMultiplayerStore();
  const globalPlayerName = useSettingsStore(s => s.playerName);
  const [displayName, setDisplayName] = useState(globalPlayerName);
  
  const isCreateDisabled = displayName.trim().length < 2 || isBusy;

  if (!game) {
    return (
      <View style={styles.container}>
        <AppBackgroundView />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Game not found</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCreate = async () => {
    if (isCreateDisabled) return;
    
    try {
      const roomCode = await createRoom(game.id, displayName.trim());
      router.push({
        pathname: `/lobby/[roomCode]`,
        params: { roomCode }
      });
    } catch {
      // Error handled by store/alert
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppBackgroundView />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <IconSymbol name="chevron.left" size={18} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 2 }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{game.name} — Setup</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <IconSymbol name="person.3.fill" size={32} color={Colors.green} />
            </View>
            <Text style={styles.heroTitle}>Create a Party Room</Text>
            <Text style={styles.heroSubtitle}>No login needed. Share the code with friends.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Name</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Display name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="go"
              onSubmitEditing={handleCreate}
            />
            <Text style={styles.hintText}>This is how others will see you.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.joinButton, isCreateDisabled && styles.joinButtonDisabled]}
            onPress={handleCreate}
            disabled={isCreateDisabled}
          >
            <Text style={styles.joinButtonText}>{isBusy ? 'Creating...' : 'Create Room'}</Text>
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
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 17, color: 'white', marginBottom: 20 },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
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
