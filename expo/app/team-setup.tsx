import { Colors } from '@/src/theme/Colors';
import { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { showToast } from '@/src/components/ToastOverlay';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';

/**
 * TeamSetupScreen — matches iOS TeamSetupView + TeamModeEntryView
 * Team assignment page: randomize, auto-balance, manual assign.
 */

// ─── Types ───

interface TeamPlayer {
  id: string;
  displayName: string;
  isConnected: boolean;
  teamId: string | null; // null = unassigned
}

interface TeamState {
  teamA: TeamPlayer[];
  teamB: TeamPlayer[];
  unassigned: TeamPlayer[];
}

const TEAM_COLORS = {
  a: { primary: Colors.orange, bg: 'rgba(255,149,0,0.12)', icon: 'flame.fill', label: 'Team A' },
  b: { primary: '#5AC8FA', bg: 'rgba(90,200,250,0.12)', icon: 'bolt.fill', label: 'Team B' },
};

// ─── Component ───

export default function TeamSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId?: string; roomCode?: string }>();
  const { currentRoom, isHost, roomCode: storeRoomCode, startGame } = useMultiplayerStore();

  const [isBusy, setIsBusy] = useState(false);
  const roomCode = params.roomCode || storeRoomCode || '------';
  const gameName = currentRoom?.gameId || 'Party Game';

  // Derive players from the live multiplayer room, fall back to empty
  const roomPlayers = currentRoom?.players ?? {};
  const [players, setPlayers] = useState<TeamPlayer[]>(() =>
    Object.entries(roomPlayers).map(([id, p]: [string, any]) => ({
      id,
      displayName: p.displayName || p.name || `Player`,
      isConnected: p.connected !== false,
      teamId: null,
    }))
  );

  const teamState = useMemo<TeamState>(() => ({
    teamA: players.filter(p => p.teamId === 'team_a'),
    teamB: players.filter(p => p.teamId === 'team_b'),
    unassigned: players.filter(p => p.teamId === null),
  }), [players]);

  const canStart = teamState.unassigned.length === 0 && teamState.teamA.length >= 1 && teamState.teamB.length >= 1;

  // ─── Actions ───

  const assignPlayer = useCallback((playerId: string, teamId: string) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, teamId } : p));
  }, []);

  const unassignPlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, teamId: null } : p));
  }, []);

  const randomizeTeams = useCallback(() => {
    setPlayers(prev => {
      const shuffled = [...prev].sort(() => Math.random() - 0.5);
      return shuffled.map((p, i) => ({
        ...p,
        teamId: i % 2 === 0 ? 'team_a' : 'team_b',
      }));
    });
  }, []);

  const autoBalanceTeams = useCallback(() => {
    setPlayers(prev => {
      const all = [...prev].sort(() => Math.random() - 0.5);
      const half = Math.ceil(all.length / 2);
      return all.map((p, i) => ({
        ...p,
        teamId: i < half ? 'team_a' : 'team_b',
      }));
    });
  }, []);

  const handleLeave = () => {
    Alert.alert(
      'Leave Room?',
      isHost ? 'This will close the room for everyone.' : 'You will leave this room.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } } },
      ]
    );
  };

  const handleStart = async () => {
    if (!canStart || !currentRoom) return;
    setIsBusy(true);
    try {
      await startGame();
      showToast.success('Team match starting!');
      router.replace(`/game/${currentRoom.gameId}/session` as any);
    } catch (e: any) {
      showToast.error(e?.message ?? 'Failed to start');
    } finally {
      setIsBusy(false);
    }
  };

  const copyRoomCode = async () => {
    await Clipboard.setStringAsync(roomCode);
    showToast.success('Room code copied!');
  };

  // ─── Render ───

  return (
    <View style={styles.container}>
      <AppBackgroundView />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={handleLeave}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
          >
            <IconSymbol name="chevron.left" size={18} color="#007AFF" />
            <Text style={{ color: '#007AFF', fontSize: 17, fontWeight: '400', marginLeft: 2 }}>Leave</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Setup</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Room Header Card */}
        <View style={styles.roomCard}>
          <LinearGradient
            colors={['rgba(168,85,247,0.86)', 'rgba(99,102,241,0.4)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.roomBanner}
          >
            <Text style={styles.roomGameName}>{gameName}</Text>
            <View style={styles.modePill}>
              <IconSymbol name="person.2.fill" size={10} color="#fff" />
              <Text style={styles.modePillText}>Team Mode</Text>
            </View>
          </LinearGradient>

          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>Room Code</Text>
            <Text style={styles.codeText}>{roomCode}</Text>
            <TouchableOpacity onPress={copyRoomCode}>
              <IconSymbol name="doc.on.doc" size={14} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Host Toolbar */}
        {isHost && (
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={randomizeTeams}>
              <IconSymbol name="shuffle" size={12} color="#A855F7" />
              <Text style={[styles.toolBtnText, { color: '#A855F7' }]}>Randomize</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, { backgroundColor: 'rgba(59,130,246,0.16)' }]} onPress={autoBalanceTeams}>
              <IconSymbol name="equal.circle.fill" size={12} color="#3B82F6" />
              <Text style={[styles.toolBtnText, { color: '#3B82F6' }]}>Auto-Balance</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Team A */}
        {renderTeamSection('a', teamState.teamA)}

        {/* Team B */}
        {renderTeamSection('b', teamState.teamB)}

        {/* Unassigned */}
        {teamState.unassigned.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Unassigned · {teamState.unassigned.length}</Text>
            <Text style={styles.sectionSubtitle}>
              {isHost ? 'Tap to assign players to a team.' : 'Waiting for host to assign players.'}
            </Text>
            {teamState.unassigned.map(player => (
              <View key={player.id} style={styles.playerRow}>
                <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Text style={styles.avatarText}>{player.displayName.charAt(0).toUpperCase()}</Text>
                  <View style={[styles.statusDot, { backgroundColor: player.isConnected ? Colors.green : '#8E8E93' }]} />
                </View>
                <Text style={styles.playerName}>{player.displayName}</Text>
                <View style={{ flex: 1 }} />
                {isHost && (
                  <>
                    <TouchableOpacity
                      style={[styles.assignBtn, { backgroundColor: 'rgba(255,149,0,0.12)' }]}
                      onPress={() => assignPlayer(player.id, 'team_a')}
                    >
                      <IconSymbol name="flame.fill" size={9} color={Colors.orange} />
                      <Text style={[styles.assignBtnText, { color: Colors.orange }]}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.assignBtn, { backgroundColor: 'rgba(90,200,250,0.12)', marginLeft: 6 }]}
                      onPress={() => assignPlayer(player.id, 'team_b')}
                    >
                      <IconSymbol name="bolt.fill" size={9} color="#5AC8FA" />
                      <Text style={[styles.assignBtnText, { color: '#5AC8FA' }]}>B</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Start Button */}
        {isHost && (
          <View style={styles.startSection}>
            <TouchableOpacity
              style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={!canStart || isBusy}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canStart ? ['#A855F7', '#7C3AED'] : ['#555', '#444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startGradient}
              >
                {isBusy ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text style={styles.startText}>Start Team Match</Text>
              </LinearGradient>
            </TouchableOpacity>

            {teamState.unassigned.length > 0 && (
              <Text style={styles.warningText}>All players must be assigned to a team.</Text>
            )}
            {teamState.unassigned.length === 0 && (!teamState.teamA.length || !teamState.teamB.length) && (
              <Text style={styles.warningText}>Each team needs at least 1 player.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ─── Team Section Renderer ───

  function renderTeamSection(teamKey: 'a' | 'b', members: TeamPlayer[]) {
    const config = TEAM_COLORS[teamKey];
    const otherTeamKey = teamKey === 'a' ? 'team_b' : 'team_a';
    const otherLabel = teamKey === 'a' ? 'B' : 'A';

    return (
      <View style={[styles.teamCard, { borderColor: `${config.primary}33` }]}>
        <View style={styles.teamHeader}>
          <IconSymbol name={config.icon as any} size={14} color={config.primary} />
          <Text style={[styles.teamName, { color: config.primary }]}>{config.label}</Text>
          <Text style={styles.teamCount}>({members.length})</Text>
        </View>

        {members.length === 0 ? (
          <View style={[styles.emptyTeam, { backgroundColor: config.bg, borderColor: `${config.primary}26` }]}>
            <IconSymbol name="person.badge.plus" size={12} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              {isHost ? 'Drag or tap players to assign' : 'Waiting for host to assign...'}
            </Text>
          </View>
        ) : (
          members.map(player => (
            <View key={player.id} style={styles.playerRow}>
              <View style={[styles.avatar, { backgroundColor: config.bg }]}>
                <Text style={[styles.avatarText, { color: config.primary }]}>
                  {player.displayName.charAt(0).toUpperCase()}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: player.isConnected ? Colors.green : '#8E8E93' }]} />
              </View>
              <Text style={styles.playerName}>{player.displayName}</Text>
              <View style={{ flex: 1 }} />

              {isHost && (
                <>
                  <TouchableOpacity
                    style={styles.moveBtn}
                    onPress={() => assignPlayer(player.id, otherTeamKey)}
                  >
                    <IconSymbol name="arrow.right" size={9} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.moveBtnText}>{otherLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => unassignPlayer(player.id)}
                  >
                    <IconSymbol name="xmark" size={10} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))
        )}
      </View>
    );
  }
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  leaveText: { fontSize: 15, fontWeight: '500', color: Colors.red },
  headerTitle: { fontFamily: 'Viral-Black', fontSize: 20, color: '#fff' },
  roomCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  roomBanner: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  roomGameName: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 6 },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  modePillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  codeLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', flex: 1 },
  codeText: { fontSize: 28, fontWeight: '900', color: '#A855F7', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.16)',
  },
  toolBtnText: { fontSize: 12, fontWeight: '600' },
  teamCard: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    marginBottom: 14,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  teamName: { fontSize: 13, fontWeight: '700' },
  teamCount: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  emptyTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 6,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.6)',
  },
  playerName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  assignBtnText: { fontSize: 11, fontWeight: '700' },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  moveBtnText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 },
  startSection: { marginTop: 6 },
  startBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  startBtnDisabled: { opacity: 0.55 },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  startText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  warningText: { fontSize: 12, color: Colors.orange, textAlign: 'center' },
});
