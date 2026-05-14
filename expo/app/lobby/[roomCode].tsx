import { Colors } from '@/src/theme/Colors';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Games } from '@/src/models/AppModels';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';
import { multiplayerService } from '@/src/services/MultiplayerService';
import { MultiplayerStatusBanner } from '@/src/components/MultiplayerStatusBanner';
import { ReportUserSheet } from '@/src/components/ReportUserSheet';
import * as Clipboard from 'expo-clipboard';

export default function LobbyScreen() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { currentRoom, isHost, localPlayerId, leaveRoom, startGame, error } = useMultiplayerStore();

  // Track how long we've been waiting for the room snapshot so we can surface
  // a real "connection took too long" UX instead of an infinite spinner.
  const [connectStart] = useState<number>(() => Date.now());
  const [waitedTooLong, setWaitedTooLong] = useState<boolean>(false);

  useEffect(() => {
    if (currentRoom) return;
    const t = setTimeout(() => setWaitedTooLong(true), 12_000);
    return () => clearTimeout(t);
  }, [currentRoom]);

  const gameKey = currentRoom ? Object.keys(Games).find(key => Games[key].id === currentRoom.gameId) : null;
  const game = gameKey ? Games[gameKey] : null;

  // Convert the players record to an array for rendering
  const players = currentRoom ? Object.values(currentRoom.players) : [];

  useEffect(() => {
    // If room is closed or game started, handle navigation
    if (currentRoom?.status === 'playing') {
      router.replace(`/game/${currentRoom.gameId}/session` as any);
    }
  }, [currentRoom?.status, router]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => router.dismissAll() }
      ]);
    }
  }, [error]);

  const handleCopyCode = async () => {
    if (roomCode) {
      await Clipboard.setStringAsync(roomCode);
      Alert.alert('Copied', 'Room code copied to clipboard!');
    }
  };

  const handleShare = async () => {
    if (!roomCode) return;
    try {
      await Share.share({
        message: `Join my PartyBot game! Room code: ${roomCode}`,
      });
    } catch (e) {
      console.log('share cancelled', e);
    }
  };

  // App Store moderation requires that any UGC surface (multiplayer rooms
  // included) exposes a user-level report/block flow. We open the sheet from
  // a long-press on a player row so it stays out of the way for normal play.
  const [reportTarget, setReportTarget] = useState<{ uid: string; name: string } | null>(null);

  const handleReport = (playerId: string, name: string) => {
    if (playerId === localPlayerId) return;
    setReportTarget({ uid: playerId, name });
  };

  const handleKick = (playerId: string, name: string) => {
    if (!isHost || !roomCode) return;
    Alert.alert('Remove Player?', `Remove ${name} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => { multiplayerService.leaveRoom(roomCode, playerId).catch(() => {}); },
      },
    ]);
  };

  const handleStartGame = async () => {
    if (isHost) {
      await startGame();
    }
  };

  const handleCloseRoom = () => {
    Alert.alert(
      isHost ? "Close Room?" : "Leave Room?",
      isHost ? "This will close the room for everyone and expire the code." : "Are you sure you want to leave?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: isHost ? "Close Room" : "Leave", 
          style: "destructive", 
          onPress: async () => {
            await leaveRoom();
            router.dismissAll();
          }
        }
      ]
    );
  };

  if (!currentRoom) {
    const elapsed = Math.round((Date.now() - connectStart) / 1000);
    return (
      <View style={[styles.container, styles.centerContent]}>
        <AppBackgroundView />
        {!waitedTooLong ? (
          <>
            <ActivityIndicator size="large" color="white" />
            <Text style={{ color: 'white', marginTop: 10 }}>Connecting…</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 4, fontSize: 12 }}>Room {roomCode} • {elapsed}s</Text>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Could not reach the room</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
              The room code may have expired, the host might be offline, or your connection dropped.
            </Text>
            <TouchableOpacity
              style={{ marginTop: 12, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
              onPress={() => router.dismissAll()}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <MultiplayerStatusBanner />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerButton} />
        <Text style={styles.headerTitle}>{isHost ? 'Host Lobby' : 'Game Lobby'}</Text>
        <TouchableOpacity onPress={handleCloseRoom} style={styles.headerButtonRight}>
          <Text style={styles.leaveText}>{isHost ? 'Close Room' : 'Leave'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Room Header Card */}
        <View style={styles.roomCard}>
          <Text style={styles.gameTitle}>{game?.name ?? 'Party Game'}</Text>
          
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.codeText}>{currentRoom.roomCode}</Text>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopyCode}>
                <IconSymbol name="doc.on.doc.fill" size={14} color="white" />
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#007AFF' }]} onPress={handleShare}>
                <IconSymbol name="square.and.arrow.up" size={14} color="white" />
                <Text style={styles.actionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Host Actions or Guest Status */}
        {isHost ? (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Host Actions</Text>
            <Text style={styles.hintText}>Wait for everyone to join before starting.</Text>
            
            <TouchableOpacity 
              style={[styles.startButton, players.length < (game?.minPlayers ?? 2) && styles.startButtonDisabled]}
              onPress={handleStartGame}
              disabled={players.length < (game?.minPlayers ?? 2)}
            >
              <Text style={styles.startButtonText}>Start Game</Text>
              <IconSymbol name="play.circle.fill" size={20} color="white" />
            </TouchableOpacity>
            
            {players.length < (game?.minPlayers ?? 2) && (
              <Text style={styles.errorText}>Waiting for at least {game?.minPlayers ?? 2} players...</Text>
            )}
          </View>
        ) : (
          <View style={styles.actionsCard}>
            <View style={styles.waitingContainer}>
              <IconSymbol name="hourglass" size={24} color="#007AFF" />
              <Text style={styles.waitingTitle}>Waiting for Host</Text>
              <Text style={styles.waitingSubtitle}>The host will start the game soon.</Text>
            </View>
          </View>
        )}

        {/* Players List */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players · {players.length} connected</Text>
          <Text style={styles.hintText}>{game?.minPlayers ?? 2}–{game?.maxPlayers ?? 10} players needed</Text>
          
          <View style={styles.playersList}>
            {players.map(player => (
              <View key={player.id} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <IconSymbol name="person.fill" size={16} color="white" />
                  </View>
                  <Text style={styles.playerName}>
                    {player.displayName} {player.id === localPlayerId ? '(You)' : ''}
                  </Text>
                </View>
                
                {player.isHost && (
                  <View style={styles.hostBadge}>
                    <IconSymbol name="star.fill" size={10} color={Colors.yellow} />
                    <Text style={styles.hostBadgeText}>HOST</Text>
                  </View>
                )}
                
                {player.id !== localPlayerId && (
                  <TouchableOpacity
                    style={styles.reportButton}
                    onPress={() => handleReport(player.id, player.displayName)}
                    accessibilityLabel={`Report ${player.displayName}`}
                  >
                    <IconSymbol name="flag" size={12} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}

                {isHost && player.id !== localPlayerId && (
                  <TouchableOpacity style={styles.kickButton} onPress={() => handleKick(player.id, player.displayName)}>
                    <Text style={styles.kickText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <ReportUserSheet
        visible={!!reportTarget}
        targetUid={reportTarget?.uid ?? ''}
        targetName={reportTarget?.name}
        onClose={() => setReportTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: { width: 80, height: 44, justifyContent: 'center' },
  headerButtonRight: { width: 80, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontFamily: 'Viral-Black', fontSize: 20, color: 'white' },
  leaveText: { color: Colors.red, fontSize: 15, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  
  roomCard: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.green,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(52, 199, 89, 0.9)',
    letterSpacing: 2,
  },
  codeText: {
    fontSize: 44,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textShadowColor: 'rgba(52, 199, 89, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  
  actionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  waitingTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  waitingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: 'rgba(52, 199, 89, 0.3)',
  },
  startButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    color: Colors.red,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  
  playersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
  },
  playersList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  hostBadgeText: {
    color: Colors.yellow,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kickButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reportButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  kickText: {
    color: Colors.red,
    fontSize: 12,
    fontWeight: '600',
  },
});
