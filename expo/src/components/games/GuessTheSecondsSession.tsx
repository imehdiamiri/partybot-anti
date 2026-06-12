import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Dimensions } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGameSync } from '@/src/hooks/useGameSync';
import { useMultiplayerStore } from '@/src/store/useMultiplayerStore';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { AudioManager } from '@/src/services/AudioManager';
import { PhaseTransition } from './PhaseTransition';
import { LiquidGlass } from '@/src/components/LiquidGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import Animated, { FadeInUp, FadeInDown, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withSpring } from 'react-native-reanimated';

// Platform-safe haptics
let Haptics: any = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

interface Props {
  session: GameSession;
}

interface TurnResult {
  playerName: string;
  round: number;
  targetTime: number;
  actualTime: number;
  difference: number;
}

type TurnPhase = 'ready' | 'running' | 'reveal';

interface SyncState {
  activeTurnIndex: number;
  turnPhase: TurnPhase;
  startedAt: number | null;          // epoch ms when host started; clients derive elapsed
  results: TurnResult[];
  roundTargets: Record<number, number>;
  lastResult: TurnResult | null;
  selectedTime: number;              // current edit value for round target
}

const initialSync: SyncState = {
  activeTurnIndex: 0,
  turnPhase: 'ready',
  startedAt: null,
  results: [],
  roundTargets: {},
  lastResult: null,
  selectedTime: 15.0,
};

export function GuessTheSecondsSession({ session }: Props) {
  const players = session.players;
  const roundsPerPlayer = Math.max(1, session.maxRounds || 3);
  const totalTurns = players.length * roundsPerPlayer;
  const { localPlayerId } = useMultiplayerStore();
  const registerSkip = useRegisterSkip();

  // Build turn order: [P1-R1, P2-R1, P1-R2, P2-R2, ...]
  const turnOrder = useMemo(() => {
    const order: { playerIndex: number; round: number }[] = [];
    for (let r = 0; r < roundsPerPlayer; r++) {
      for (let p = 0; p < players.length; p++) {
        order.push({ playerIndex: p, round: r + 1 });
      }
    }
    return order;
  }, [players.length, roundsPerPlayer]);

  const [sync, setSync] = useState<SyncState>(initialSync);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Authoritative reducer — runs on host only (or single-device).
  const apply = useCallback((type: string, data: any, prev: SyncState): SyncState => {
    switch (type) {
      case 'setTarget': {
        const next = Math.min(Math.max(Math.round(data.value * 100) / 100, 1), 60);
        return { ...prev, selectedTime: next };
      }
      case 'start': {
        if (prev.turnPhase !== 'ready' || prev.activeTurnIndex >= totalTurns) return prev;
        const turn = turnOrder[prev.activeTurnIndex];
        const roundTargets = { ...prev.roundTargets };
        if (roundTargets[turn.round] === undefined) {
          roundTargets[turn.round] = Math.round(prev.selectedTime * 100) / 100;
        }
        return {
          ...prev,
          turnPhase: 'running',
          startedAt: Date.now(),
          roundTargets,
        };
      }
      case 'stop': {
        if (prev.turnPhase !== 'running' || !prev.startedAt) return prev;
        const turn = turnOrder[prev.activeTurnIndex];
        const player = players[turn.playerIndex];
        if (!player) return prev;
        const actualTime = Math.round(((Date.now() - prev.startedAt) / 1000) * 100) / 100;
        const targetTime = prev.roundTargets[turn.round] ?? Math.round(prev.selectedTime * 100) / 100;
        const difference = Math.round(Math.abs(targetTime - actualTime) * 100) / 100;
        const result: TurnResult = {
          playerName: player.displayName,
          round: turn.round,
          targetTime,
          actualTime,
          difference,
        };
        return {
          ...prev,
          turnPhase: 'reveal',
          startedAt: null,
          results: [...prev.results, result],
          lastResult: result,
        };
      }
      case 'skip': {
        if (prev.activeTurnIndex >= totalTurns) return prev;
        const turn = turnOrder[prev.activeTurnIndex];
        const player = players[turn.playerIndex];
        if (!player) return prev;
        const targetTime = prev.roundTargets[turn.round] ?? Math.round(prev.selectedTime * 100) / 100;
        const result: TurnResult = {
          playerName: player.displayName,
          round: turn.round,
          targetTime,
          actualTime: 0,
          difference: 99.9,
        };
        const roundTargets = { ...prev.roundTargets };
        if (roundTargets[turn.round] === undefined) {
          roundTargets[turn.round] = targetTime;
        }
        return {
          ...prev,
          turnPhase: 'reveal',
          startedAt: null,
          results: [...prev.results, result],
          lastResult: result,
          roundTargets,
        };
      }
      case 'continue': {
        const nextIdx = prev.activeTurnIndex + 1;
        return {
          ...prev,
          activeTurnIndex: nextIdx,
          turnPhase: 'ready',
          lastResult: null,
        };
      }
      case 'playAgain':
        return { ...initialSync };
      default:
        return prev;
    }
  }, [totalTurns, turnOrder, players]);

  const onActionReceived = useCallback((type: string, data: any) => {
    setSync(prev => {
      const next = apply(type, data, prev);
      // Host syncs the resulting state below via syncState callback.
      return next;
    });
  }, [apply]);

  const { syncState, sendAction, isHost, isMultiplayer } = useGameSync<SyncState>(
    session.mode,
    sync,
    setSync,
    onActionReceived
  );

  // Host: whenever local sync changes, push the snapshot. (Host's reducer
  // updates state immediately; broadcast keeps clients in lock step.)
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;
    syncState(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, isHost, isMultiplayer]);

  // Compute elapsed time locally for smooth UI on every device.
  useEffect(() => {
    if (sync.turnPhase !== 'running' || !sync.startedAt) {
      setElapsedTime(0);
      return;
    }
    const tick = () => setElapsedTime((Date.now() - (sync.startedAt as number)) / 1000);
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [sync.turnPhase, sync.startedAt]);


  // ───────── Derived state ─────────
  const isFinished = sync.activeTurnIndex >= totalTurns;
  const currentTurn = !isFinished ? turnOrder[sync.activeTurnIndex] : null;
  const currentRoundNumber = currentTurn ? currentTurn.round : roundsPerPlayer;
  const currentPlayer = currentTurn ? players[currentTurn.playerIndex] : null;
  const isFirstPlayerOfCurrentRound = currentTurn ? currentTurn.playerIndex === 0 : false;
  const currentRoundTargetLocked = sync.roundTargets[currentRoundNumber] !== undefined;
  const displayedTargetTime = sync.roundTargets[currentRoundNumber] ?? sync.selectedTime;

  // In multi-device, only the active player drives controls. In single-device
  // anyone can drive (one phone passed around).
  const isLocalActive = !isMultiplayer
    ? true
    : !!currentPlayer && (currentPlayer.id === localPlayerId || isHost);

  useEffect(() => {
    if (!isFinished && (sync.turnPhase === 'ready' || sync.turnPhase === 'running') && isLocalActive) {
      registerSkip(() => {
        sendAction('skip', {});
      }, currentPlayer?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [isFinished, sync.turnPhase, isLocalActive, currentPlayer, registerSkip]);

  const canEditTargetTime =
    sync.turnPhase === 'ready' &&
    !isFinished &&
    isFirstPlayerOfCurrentRound &&
    !currentRoundTargetLocked &&
    isLocalActive;

  // Build per-player score summary
  const playerScores = useMemo(() => {
    if (players.length === 0) return [];
    return players.map(p => {
      const pResults = sync.results.filter(r => r.playerName === p.displayName);
      const total = pResults.reduce((sum, r) => sum + r.difference, 0);
      const avg = pResults.length > 0 ? total / pResults.length : 0;
      return { player: p.displayName, total, avg, turns: pResults.length };
    }).sort((a, b) => a.total - b.total);
  }, [sync.results, players]);

  if (players.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 16 }}>No players found. Go back and add players.</Text>
      </View>
    );
  }

  // ───────── Action dispatchers ─────────
  const adjustTargetTime = (delta: number) => {
    if (!canEditTargetTime) return;
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    AudioManager.play('buttonTap');
    sendAction('setTarget', { value: sync.selectedTime + delta });
  };

  const startTurn = () => {
    if (sync.turnPhase !== 'ready' || isFinished || !isLocalActive) return;
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
    AudioManager.play('buttonTap');
    sendAction('start', {});
  };

  const stopTurn = () => {
    if (sync.turnPhase !== 'running' || !isLocalActive) return;
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    AudioManager.play('buttonTap');
    sendAction('stop', {});
  };

  const continueToNextTurn = () => {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    AudioManager.play('phaseChange');
    sendAction('continue', {});
  };

  const playAgain = () => {
    AudioManager.play('buttonTap');
    sendAction('playAgain', {});
  };

  const getAccuracyBand = (diff: number) => {
    if (diff === 0) return { title: 'Perfect!', color: Colors.green, icon: 'target' as const };
    if (diff < 1) return { title: 'Close', color: Colors.blue, icon: 'scope' as const };
    if (diff <= 2) return { title: 'Okay', color: Colors.yellow, icon: 'scope' as const };
    return { title: 'Far', color: Colors.red, icon: 'scope' as const };
  };

  // Whose-turn label suffix used in multi-device to remind non-active players to watch.
  const turnHint = isMultiplayer && !isLocalActive && currentPlayer
    ? `Waiting for ${currentPlayer.displayName}…`
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Header Card */}
      <LiquidGlass radius={24} style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.roundText}>
            {isFinished ? 'All rounds complete' : `Round ${currentRoundNumber} / ${roundsPerPlayer}`}
          </Text>
          {currentPlayer && !isFinished && (
            <PhaseTransition phaseKey={currentPlayer.id} type="scale">
              <View style={styles.nowPlayingBadge}>
                <Text style={styles.nowPlayingText}>{currentPlayer.displayName}'s Turn</Text>
              </View>
            </PhaseTransition>
          )}
          <View style={{flex: 1}}/>
          <Text style={[styles.statusLabel, {
            color: sync.turnPhase === 'running' ? Colors.blue
              : sync.turnPhase === 'reveal' ? Colors.yellow
              : isFinished ? Colors.green
              : 'rgba(255,255,255,0.5)'
          }]}>
            {isFinished ? 'Finished' : sync.turnPhase === 'running' ? 'Running' : sync.turnPhase === 'reveal' ? 'Result' : 'Ready'}
          </Text>
        </View>
        {turnHint && <Text style={styles.waitingHint}>{turnHint}</Text>}
      </LiquidGlass>

      {/* Turn Result Banner */}
      {sync.turnPhase === 'reveal' && sync.lastResult && (
        <PhaseTransition phaseKey="reveal" type="scale">
        <LiquidGlass radius={24} style={[styles.card, { borderColor: getAccuracyBand(sync.lastResult.difference).color + '55' }]}>
          <View style={styles.resultHeader}>
            <IconSymbol name="flag.checkered" size={20} color={getAccuracyBand(sync.lastResult.difference).color} />
            <Text style={styles.resultTitle}>{sync.lastResult.playerName} • Round {sync.lastResult.round}</Text>
            <View style={{flex: 1}}/>
            <View style={[styles.badge, { backgroundColor: getAccuracyBand(sync.lastResult.difference).color + '33' }]}>
              <Text style={[styles.badgeText, { color: getAccuracyBand(sync.lastResult.difference).color }]}>
                {getAccuracyBand(sync.lastResult.difference).title}
              </Text>
            </View>
          </View>
          <LiquidGlass radius={20} variant="low" style={styles.resultMainMetricBox}>
            <Text style={styles.metricLabel}>Stopped at</Text>
            <Text style={[styles.mainMetricValue, { color: getAccuracyBand(sync.lastResult.difference).color }]}>
              {sync.lastResult.actualTime.toFixed(2)}s
            </Text>
          </LiquidGlass>
          <View style={styles.resultSubMetrics}>
            <LiquidGlass radius={16} variant="low" style={styles.metricBox}>
              <Text style={styles.metricLabel}>Target</Text>
              <Text style={[styles.metricValue, { color: 'rgba(255,255,255,0.7)' }]}>{sync.lastResult.targetTime.toFixed(2)}</Text>
            </LiquidGlass>
            <LiquidGlass radius={16} variant="low" style={styles.metricBox}>
              <Text style={styles.metricLabel}>Difference</Text>
              <Text style={[styles.metricValue, { color: getAccuracyBand(sync.lastResult.difference).color }]}>
                {sync.lastResult.difference.toFixed(2)}
              </Text>
            </LiquidGlass>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: Colors.blue, marginTop: 16 },
              isMultiplayer && !isHost && { opacity: 0.5 },
            ]}
            onPress={continueToNextTurn}
            disabled={isMultiplayer && !isHost}
          >
            <IconSymbol name="arrow.right" size={20} color="white" />
            <Text style={styles.primaryButtonText}>
              {sync.activeTurnIndex + 1 >= totalTurns ? 'See Results' : 'Next Turn'}
            </Text>
          </Pressable>
        </LiquidGlass>
        </PhaseTransition>
      )}

      {/* Control Card */}
      {!isFinished && sync.turnPhase !== 'reveal' && (
        <PhaseTransition phaseKey={sync.turnPhase} type="scale">
        <LiquidGlass radius={24} style={styles.card}>
          <Text style={styles.sectionTitle}>Target Time</Text>
          <Text style={styles.sectionSubtitle}>
            {currentRoundTargetLocked ? "This round target is locked for all players." : "Choose the target for this round."}
          </Text>

          <View style={styles.selectorArea}>
            <Pressable
              style={[styles.stepperButton, !canEditTargetTime && styles.stepperDisabled]}
              onPress={() => adjustTargetTime(-1)}
              disabled={!canEditTargetTime}
            >
              <IconSymbol name="minus" size={24} color={canEditTargetTime ? "white" : "rgba(255,255,255,0.3)"} />
            </Pressable>

            <LiquidGlass radius={20} variant="low" style={styles.timeDisplayBox}>
              {sync.turnPhase === 'running' ? (
                <View style={styles.runningIndicator}>
                  <IconSymbol name="timer" size={32} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.runningLabel}>Counting…</Text>
                </View>
              ) : (
                <Text style={styles.timeDisplay}>
                  {displayedTargetTime.toFixed(2)}
                </Text>
              )}
            </LiquidGlass>

            <Pressable
              style={[styles.stepperButton, !canEditTargetTime && styles.stepperDisabled]}
              onPress={() => adjustTargetTime(1)}
              disabled={!canEditTargetTime}
            >
              <IconSymbol name="plus" size={24} color={canEditTargetTime ? "white" : "rgba(255,255,255,0.3)"} />
            </Pressable>
          </View>

          <View style={styles.controlButtons}>
            {sync.turnPhase === 'ready' && (
              <PhaseTransition phaseKey="start-btn" type="scale">
                <Pressable
                  style={[styles.primaryButton, styles.giantButton, { backgroundColor: Colors.blue }, !isLocalActive && { opacity: 0.5 }]}
                  onPress={startTurn}
                  disabled={!isLocalActive}
                >
                  <IconSymbol name="play.fill" size={48} color="white" />
                  <Text style={styles.giantButtonText}>Start</Text>
                </Pressable>
              </PhaseTransition>
            )}
            {sync.turnPhase === 'running' && (
              <PhaseTransition phaseKey="stop-btn" type="scale">
                <Pressable
                  style={[styles.primaryButton, styles.giantButton, { backgroundColor: Colors.red }, !isLocalActive && { opacity: 0.5 }]}
                  onPress={stopTurn}
                  disabled={!isLocalActive}
                >
                  <IconSymbol name="stop.fill" size={48} color="white" />
                  <Text style={styles.giantButtonText}>Stop</Text>
                </Pressable>
              </PhaseTransition>
            )}
          </View>
        </LiquidGlass>
        </PhaseTransition>
      )}

      {/* Live Score Table */}
      {sync.results.length > 0 && !isFinished && (
        <LiquidGlass radius={24} style={styles.card}>
          <Text style={styles.sectionTitle}>Scores</Text>
          <Text style={styles.sectionSubtitle}>Lower difference is better</Text>

          <View style={styles.scoreTable}>
            <View style={styles.scoreHeaderRow}>
              <Text style={[styles.scoreHeaderCell, { flex: 2 }]}>Player</Text>
              {Array.from({ length: currentRoundNumber }, (_, i) => (
                <Text key={i} style={styles.scoreHeaderCell}>R{i + 1}</Text>
              ))}
              <Text style={[styles.scoreHeaderCell, { fontWeight: 'bold' }]}>Total</Text>
            </View>

            {players.map((p) => {
              const pResults = sync.results.filter(r => r.playerName === p.displayName);
              const total = pResults.reduce((sum, r) => sum + r.difference, 0);
              return (
                <View
                  key={p.id}
                  style={[
                    styles.scoreRow,
                    currentPlayer?.displayName === p.displayName && sync.turnPhase !== 'reveal' && styles.scoreRowActive,
                  ]}
                >
                  <Text style={[styles.scoreCell, { flex: 2 }]} numberOfLines={1}>{p.displayName}</Text>
                  {Array.from({ length: currentRoundNumber }, (_, roundIdx) => {
                    const roundResult = pResults.find(r => r.round === roundIdx + 1);
                    if (!roundResult) return <Text key={roundIdx} style={styles.scoreCell}>—</Text>;
                    const band = getAccuracyBand(roundResult.difference);
                    return (
                      <Text key={roundIdx} style={[styles.scoreCell, { color: band.color }]}>
                        {roundResult.difference.toFixed(1)}
                      </Text>
                    );
                  })}
                  <Text style={[styles.scoreCell, { fontWeight: 'bold' }]}>{total.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </LiquidGlass>
      )}

      {/* Final Ranking Card */}
      {isFinished && (
        <PhaseTransition phaseKey="finished" type="fade">
        <LiquidGlass radius={24} style={styles.card}>
          <ResultsScoreboard
            title="Final Results"
            subtitle="Lowest total difference wins."
            entries={playerScores.map<RankEntry>((rank) => ({
              id: rank.player,
              name: rank.player,
              primary: rank.total.toFixed(2),
              secondary: `Avg ${rank.avg.toFixed(2)}`,
            }))}
          />

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: Colors.green, marginTop: 16 },
              isMultiplayer && !isHost && { opacity: 0.5 },
            ]}
            onPress={playAgain}
            disabled={isMultiplayer && !isHost}
          >
            <IconSymbol name="arrow.counterclockwise" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Play Again</Text>
          </Pressable>
        </LiquidGlass>
        </PhaseTransition>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    padding: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  nowPlayingBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  nowPlayingText: { color: Colors.green, fontSize: 16, fontFamily: 'Viral-Black' },
  statusLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  waitingHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13, marginTop: 8, fontStyle: 'italic',
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  resultTitle: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  resultMainMetricBox: {
    paddingVertical: 24, alignItems: 'center',
    marginBottom: 12,
  },
  mainMetricValue: { color: 'white', fontSize: 40, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  resultSubMetrics: { flexDirection: 'row', gap: 10 },
  metricBox: {
    flex: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  metricLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { color: 'white', fontSize: 18, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  sectionTitle: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black' },
  sectionSubtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 2, marginBottom: 16 },
  selectorArea: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  stepperButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(10, 132, 255, 0.25)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(10, 132, 255, 0.4)',
  },
  stepperDisabled: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
  timeDisplayBox: {
    flex: 1,
    paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
  },
  timeDisplay: { color: 'white', fontSize: 36, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  runningIndicator: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  runningLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' },
  controlButtons: { gap: 14 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18, borderRadius: 20, overflow: 'hidden',
  },
  primaryButtonText: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black' },
  giantButton: { paddingVertical: 40, borderRadius: 28 },
  giantButtonText: { color: 'white', fontSize: 22, fontFamily: 'Viral-Black' },
  scoreTable: { gap: 2 },
  scoreHeaderRow: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  scoreHeaderCell: { flex: 1, color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase' },
  scoreRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  scoreRowActive: { backgroundColor: 'rgba(10, 132, 255, 0.1)' },
  scoreCell: { flex: 1, color: 'white', fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
