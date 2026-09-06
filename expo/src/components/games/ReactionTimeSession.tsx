import { useGameActivity, GAME_UI } from './GameActivity';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, cancelAnimation } from 'react-native-reanimated';
import { Colors } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { GameMode } from '@/src/models/AppModels';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';
import { useCompetitiveRound } from '@/src/hooks/useCompetitiveRound';
import { rankReactionTimeResults } from '@/src/models/CompetitiveRound';
import { getServerNow } from '@/src/services/ServerClock';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props { session: GameSession; }

type Phase = 'ready' | 'waiting' | 'go' | 'tapped' | 'foul' | 'playerComplete' | 'results';
type MultiSubPhase = 'init' | 'waiting' | 'go' | 'tapped' | 'foul';

const ATTEMPTS_PER_PLAYER = 3;
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 7000;

interface Attempt {
  ms: number | null; // null = foul
}
interface PlayerRecord {
  playerId: string;
  attempts: Attempt[];
}

export function ReactionTimeSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const players = session.players;
  const isMultiplayer = session.mode === GameMode.multiDevice;

  // ─── MULTIPLAYER SYNC HOOK ───
  const compRound = useCompetitiveRound({
    gameId: session.game.id,
    mode: session.mode,
    players: session.players,
    roundDurationSeconds: 35,
    countdownSeconds: 5,
  });

  const localPlayerId = compRound.localPlayerId;
  const localPlayer = players.find(p => p.id === localPlayerId) || players.find(p => p.isLocal) || players[0];

  // Local multiplayer sub-state
  const [multiSubPhase, setMultiSubPhase] = useState<MultiSubPhase>('init');
  const [multiRecordedMs, setMultiRecordedMs] = useState<number | null>(null);

  // Single-device state
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState<number>(0);
  useGameActivity(isMultiplayer ? localPlayer?.displayName : players[playerIdx]?.displayName, isMultiplayer ? (compRound.isLocallyCompleted ? 'complete' : compRound.phase) : phase);
  const [attemptIdx, setAttemptIdx] = useState<number>(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [records, setRecords] = useState<PlayerRecord[]>(() =>
    players.map(p => ({ playerId: p.id, attempts: [] }))
  );

  const goAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = players[playerIdx];
  const currentRecord = records[playerIdx];
  const attemptsDone = currentRecord?.attempts.length ?? 0;

  const pulse = useSharedValue<number>(1);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const goAtTimestamp = compRound.goAtTimestamp || (compRound.roundState.scheduledStartAt + 3000 + (compRound.seed % 3000));

  // Handle multiplayer round transitions & continuous server-aligned phase tracking
  useEffect(() => {
    if (!isMultiplayer) return;

    if (compRound.phase === 'countdown') {
      setMultiSubPhase('init');
      setMultiRecordedMs(null);
      return;
    }

    if (compRound.phase === 'playing' && !compRound.localSubmitted) {
      const interval = setInterval(() => {
        const now = getServerNow();
        if (now < compRound.roundState.scheduledStartAt) {
          return;
        }
        if (now < goAtTimestamp) {
          setMultiSubPhase(prev => (prev === 'tapped' || prev === 'foul' ? prev : 'waiting'));
        } else {
          setMultiSubPhase(prev => {
            if (prev === 'tapped' || prev === 'foul' || prev === 'go') return prev;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            return 'go';
          });
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isMultiplayer, compRound.phase, compRound.localSubmitted, compRound.roundState.roundId, compRound.roundState.scheduledStartAt, goAtTimestamp]);

  useEffect(() => {
    if (isMultiplayer) {
      registerSkip(null);
      return;
    }
    if (phase === 'waiting' || phase === 'go' || phase === 'tapped' || phase === 'foul') {
      registerSkip(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        cancelAnimation(pulse);
        const isLast = playerIdx + 1 >= players.length;
        if (isLast) {
          setPhase('results');
        } else {
          setPlayerIdx(playerIdx + 1);
          setAttemptIdx(0);
          setPhase('ready');
        }
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [isMultiplayer, phase, playerIdx, player, registerSkip, pulse, players.length]);

  const beginAttempt = useCallback(() => {
    setPhase('waiting');
    setLastMs(null);
    pulse.value = 1;
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timerRef.current = setTimeout(() => {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 100 });
      goAtRef.current = performance.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPhase('go');
    }, delay);
  }, [pulse]);

  const recordAttempt = useCallback((ms: number | null) => {
    setRecords(prev => {
      const next = prev.map(r => ({ ...r, attempts: [...r.attempts] }));
      next[playerIdx].attempts.push({ ms });
      return next;
    });
  }, [playerIdx]);

  // Handle screen press for multiplayer anchored to absolute goAtTimestamp
  const handleMultiScreenPress = () => {
    if (compRound.phase !== 'playing' || compRound.localSubmitted) return;
    const now = getServerNow();

    if (now < goAtTimestamp) {
      // Foul — tapped before green
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMultiRecordedMs(null);
      setMultiSubPhase('foul');
      compRound.submitResult({
        score: 99999,
        completedAt: now,
        didFinish: false,
        details: { foul: true },
      });
      return;
    }

    // Valid tap on green
    const reactionMs = Math.max(1, Math.round(now - goAtTimestamp));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMultiRecordedMs(reactionMs);
    setMultiSubPhase('tapped');
    compRound.submitResult({
      score: reactionMs,
      completedAt: now,
      didFinish: true,
    });
  };

  const handleScreenPress = () => {
    if (isMultiplayer) {
      handleMultiScreenPress();
      return;
    }
    if (phase === 'waiting') {
      // Foul — tapped too early
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 100 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      recordAttempt(null);
      setLastMs(null);
      setPhase('foul');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - goAtRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      recordAttempt(ms);
      setLastMs(ms);
      setPhase('tapped');
      return;
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // ══════════════════════════════════════════════════════════
  // MULTIPLAYER MODES
  // ══════════════════════════════════════════════════════════
  if (isMultiplayer) {
    // 1. Synchronized Countdown
    if (compRound.phase === 'countdown') {
      return (
        <PhaseTransition phaseKey="multi-countdown" style={st.container}>
          <View style={st.center}>
            <View style={[st.iconBox, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
              <IconSymbol name="bolt.fill" size={54} color={Colors.green} />
            </View>
            <Text style={st.title}>Get Ready!</Text>
            <Text style={st.sub}>Wait for the screen to turn GREEN, then tap as fast as you can.</Text>
            <View style={st.countdownCircle}>
              <Text style={st.countdownNum}>{compRound.countdownRemaining}</Text>
            </View>
            <Text style={st.waitingSub}>Starting synchronized round for all devices...</Text>
          </View>
        </PhaseTransition>
      );
    }

    // 2. Synchronized Active Play / Waiting for other players
    if (compRound.phase === 'playing') {
      // If completed or submitted on this device (sending, delivered, accepted, or error), show status panel
      if (compRound.isLocallyCompleted || multiSubPhase === 'tapped' || multiSubPhase === 'foul') {
        const isFoul = compRound.pendingResult?.details?.foul === true || multiSubPhase === 'foul' || (compRound.pendingResult?.score ?? 0) >= 99999;
        const displayScore = compRound.pendingResult?.score ?? multiRecordedMs ?? 0;
        return (
          <PhaseTransition phaseKey="multi-submitted" style={st.container}>
            <View style={st.center}>
              <View style={[st.iconBox, { backgroundColor: isFoul ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)' }]}>
                <IconSymbol 
                  name={isFoul ? "xmark.octagon.fill" : "checkmark.circle.fill"} 
                  size={54} 
                  color={isFoul ? Colors.red : Colors.green} 
                />
              </View>
              <Text style={st.title}>{isFoul ? 'Too Early (Foul)' : `${displayScore} ms`}</Text>
              <Text style={st.sub}>{isFoul ? 'You tapped while screen was red.' : describeTime(displayScore)}</Text>
              
              {compRound.submissionStatus === 'error' && compRound.submissionError ? (
                <Pressable
                  style={[st.waitingBox, { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.3)', borderWidth: 1 }]}
                  onPress={() => compRound.retrySubmission()}>
                  <IconSymbol name="arrow.clockwise" size={16} color={Colors.red} />
                  <Text style={[st.waitingBoxText, { color: Colors.red }]}>
                    {compRound.submissionError} (Tap to retry)
                  </Text>
                </Pressable>
              ) : compRound.submissionStatus === 'sending' ? (
                <View style={st.waitingBox}>
                  <ActivityIndicator size="small" color="#FF9500" />
                  <Text style={[st.waitingBoxText, { color: '#FF9500' }]}>
                    Delivering result to host...
                  </Text>
                </View>
              ) : (
                <View style={st.waitingBox}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={st.waitingBoxText}>
                    Waiting for other players... ({compRound.completedCount} / {compRound.totalPlayers})
                  </Text>
                </View>
              )}
            </View>
          </PhaseTransition>
        );
      }

      // Waiting (Red)
      if (multiSubPhase === 'waiting' || multiSubPhase === 'init') {
        return (
          <Pressable style={[st.fullPress, { backgroundColor: Colors.red }]} onPress={handleMultiScreenPress}>
            <Animated.View style={[st.fullCenter, pulseStyle]} pointerEvents="none">
              <Text style={st.waitText}>Wait for green</Text>
            </Animated.View>
            <View style={st.attemptBadge}>
              <Text style={st.attemptBadgeTx}>Multiplayer · 1 Attempt</Text>
            </View>
          </Pressable>
        );
      }

      // Go (Green)
      if (multiSubPhase === 'go') {
        return (
          <Pressable style={[st.fullPress, { backgroundColor: Colors.green }]} onPress={handleMultiScreenPress}>
            <View style={st.fullCenter}>
              <Text style={st.megaText}>TAP!</Text>
            </View>
          </Pressable>
        );
      }
    }

    // 3. Synchronized Results
    if (compRound.phase === 'results') {
      const playerNamesMap = Object.fromEntries(players.map(p => [p.id, p.displayName]));
      const participantIds = compRound.roundState.participantIds?.length ? compRound.roundState.participantIds : players.map(p => p.id);
      const ranked = rankReactionTimeResults(
        compRound.results,
        participantIds,
        playerNamesMap
      );

      const entries: RankEntry[] = ranked.map(r => ({
        id: r.playerId,
        name: r.displayName,
        isSkipped: !r.didFinish,
        primary: r.didFinish ? `${r.score} ms` : 'Foul / DNF',
        secondary: r.didFinish ? describeTime(r.score) : 'Tapped early or timed out',
      }));

      return (
        <PhaseTransition phaseKey="multi-results" style={st.container}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <ResultsScoreboard
              entries={entries}
              title="Round Leaderboard"
              subtitle="Fastest reaction time wins"
              onPlayAgain={compRound.isHost ? compRound.playAgain : undefined}
              playAgainTitle="Next Round"
              shareGameName="Reaction Time"
            />
          </ScrollView>
        </PhaseTransition>
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  // SINGLE-DEVICE (PASS & PLAY) FLOW
  // ══════════════════════════════════════════════════════════

  const continueAfterAttempt = () => {
    const done = (currentRecord?.attempts.length ?? 0);
    if (done >= ATTEMPTS_PER_PLAYER) {
      const isLast = playerIdx + 1 >= players.length;
      if (isLast) {
        setPhase('results');
      } else {
        setPhase('playerComplete');
      }
    } else {
      setAttemptIdx(done);
      beginAttempt();
    }
  };

  const goToNextPlayer = () => {
    const isLast = playerIdx + 1 >= players.length;
    if (isLast) {
      setPhase('results');
    } else {
      setPlayerIdx(playerIdx + 1);
      setAttemptIdx(0);
      beginAttempt();
    }
  };

  const playAgain = () => {
    setRecords(players.map(p => ({ playerId: p.id, attempts: [] })));
    setPlayerIdx(0);
    setAttemptIdx(0);
    setLastMs(null);
    setPhase('ready');
  };

  // ─── READY ───
  if (phase === 'ready') {
    return (
      <PhaseTransition phaseKey={`ready-${playerIdx}`} style={{ flex: 1 }}>
        <GamePassPhoneView
          playerName={player?.displayName || 'Player'}
          title={players.length > 1 && playerIdx > 0 ? "Pass the phone to" : "Get ready"}
          subtitle="Get ready for your reaction time test!"
          accentColor={Colors.green}
          onReady={beginAttempt}
          onSkip={() => {
            const isLast = playerIdx + 1 >= players.length;
            if (isLast) {
              setPhase('results');
            } else {
              setPlayerIdx(playerIdx + 1);
              setAttemptIdx(0);
              setPhase('ready');
            }
          }}
        />
      </PhaseTransition>
    );
  }

  // ─── WAITING (RED) ───
  if (phase === 'waiting') {
    return (
      <Pressable testID="reaction-time-press" style={[st.fullPress, { backgroundColor: Colors.red }]} onPress={handleScreenPress}>
        <Animated.View style={[st.fullCenter, pulseStyle]} pointerEvents="none">
          <Text style={st.waitText}>Wait for green</Text>
        </Animated.View>
        <View style={st.attemptBadge}>
          <Text style={st.attemptBadgeTx}>Attempt {attemptIdx + 1} / {ATTEMPTS_PER_PLAYER}</Text>
        </View>

      </Pressable>
    );
  }

  // ─── GO (GREEN) ───
  if (phase === 'go') {
    return (
      <Pressable testID="reaction-time-press" style={[st.fullPress, { backgroundColor: Colors.green }]} onPress={handleScreenPress}>
        <View style={st.fullCenter}>
          <Text style={st.megaText}>TAP!</Text>
        </View>
      </Pressable>
    );
  }

  // ─── TAPPED ───
  if (phase === 'tapped') {
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <IconSymbol name="checkmark.circle.fill" size={64} color={Colors.green} />
          </View>
          <Text style={st.title}>{lastMs} ms</Text>
          <Text style={st.sub}>{describeTime(lastMs ?? 0)}</Text>
          <AttemptDots attempts={currentRecord.attempts} total={ATTEMPTS_PER_PLAYER} />
          <Pressable testID="reaction-time-continue-button" style={[st.startBtn, { backgroundColor: '#007AFF' }]} onPress={continueAfterAttempt}>
            <Text style={st.startBtnTx}>
              {attemptsDone >= ATTEMPTS_PER_PLAYER ? 'See Result' : 'Next Attempt'}
            </Text>
          </Pressable>
        </View>
      </PhaseTransition>
    );
  }

  // ─── FOUL ───
  if (phase === 'foul') {
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,59,48,0.18)' }]}>
            <IconSymbol name="xmark.octagon.fill" size={64} color={Colors.red} />
          </View>
          <Text style={st.title}>Too Early!</Text>
          <Text style={st.sub}>You tapped while still red — that attempt is a foul.</Text>
          <AttemptDots attempts={currentRecord.attempts} total={ATTEMPTS_PER_PLAYER} />
          <Pressable testID="reaction-time-continue-button" style={[st.startBtn, { backgroundColor: Colors.orange }]} onPress={continueAfterAttempt}>
            <Text style={st.startBtnTx}>
              {attemptsDone >= ATTEMPTS_PER_PLAYER ? 'See Result' : 'Try Again'}
            </Text>
          </Pressable>
        </View>
      </PhaseTransition>
    );
  }

  // ─── PLAYER COMPLETE ───
  if (phase === 'playerComplete') {
    const best = bestMs(currentRecord.attempts);
    const isLast = playerIdx + 1 >= players.length;
    return (
      <GamePlayerCompleteView
        nextPlayerName={isLast ? '' : (players[playerIdx + 1]?.displayName ?? 'Next Player')}
        prevResultLine={best != null ? `Best: ${best}ms · ${ATTEMPTS_PER_PLAYER} attempts` : `${ATTEMPTS_PER_PLAYER} attempts done`}
        onReady={goToNextPlayer}
        accentColor={Colors.green}
      />
    );
  }

  // ─── RESULTS ───
  const entries: RankEntry[] = [...records]
    .map(r => {
      const best = bestMs(r.attempts);
      const p = players.find(pp => pp.id === r.playerId);
      return {
        record: r,
        best,
        name: p?.displayName ?? 'Player',
      };
    })
    .sort((a, b) => {
      if (a.best == null && b.best == null) return 0;
      if (a.best == null) return 1;
      if (b.best == null) return -1;
      return a.best - b.best;
    })
    .map((row): RankEntry => ({
      id: row.record.playerId,
      name: row.name,
      isSkipped: row.best == null,
      primary: row.best == null ? 'Skipped' : `${row.best} ms`,
      secondary: row.best == null ? 'Did not play' : attemptsSummary(row.record.attempts),
    }));

  return (
    <PhaseTransition phaseKey={phase} style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Your Result'}
          subtitle="Lowest reaction time wins"
          onPlayAgain={playAgain}
          shareGameName="Reaction Time"
        />
      </ScrollView>
    </PhaseTransition>
  );
}

// ─── helpers ───
function bestMs(attempts: Attempt[]): number | null {
  const valid = attempts.map(a => a.ms).filter((m): m is number => typeof m === 'number');
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

function attemptsSummary(attempts: Attempt[]): string {
  if (attempts.length === 0) return 'No attempts';
  return attempts
    .map(a => (a.ms == null ? 'Foul' : `${a.ms}`))
    .join(' · ');
}

function describeTime(ms: number): string {
  if (ms < 200) return 'Lightning reflexes!';
  if (ms < 280) return 'Excellent!';
  if (ms < 360) return 'Great reaction.';
  if (ms < 450) return 'Solid.';
  return 'Keep practicing.';
}

function RuleRow({ num, color, text }: { num: number; color: string; text: string }) {
  return (
    <View style={st.ruleRow}>
      <View style={[st.ruleNum, { backgroundColor: color + '33', borderColor: color + '66' }]}>
        <Text style={[st.ruleNumTx, { color }]}>{num}</Text>
      </View>
      <Text style={st.ruleTx}>{text}</Text>
    </View>
  );
}

function AttemptDots({ attempts, total }: { attempts: Attempt[]; total: number }) {
  return (
    <View style={st.dotsRow}>
      {Array.from({ length: total }).map((_, i) => {
        const a = attempts[i];
        const filled = !!a;
        const isFoul = a?.ms == null;
        const bg = !filled
          ? 'rgba(255,255,255,0.1)'
          : isFoul
          ? Colors.red
          : Colors.green;
        return <View key={i} style={[st.dot, { backgroundColor: bg }]} />;
      })}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14, maxWidth: 540, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  iconBox: {
    width: 100, height: 100, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 28, fontFamily: 'Viral-Black', textAlign: 'center' },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'Viral-Black',
    letterSpacing: 2.4,
    textAlign: 'center',
    marginTop: 4,
  },
  nameTitle: {
    color: '#fff',
    fontSize: 40,
    fontFamily: 'Viral-Black',
    textAlign: 'center',
    letterSpacing: 0.3,
    paddingHorizontal: 8,
  },
  handoffCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(90,200,250,0.10)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(90,200,250,0.25)',
    marginTop: 8,
  },
  handoffTx: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 18, textAlign: 'center' },
  pill: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },
  pillTx: { color: Colors.green, fontSize: 15, fontWeight: '700' },

  rulesCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 12, marginTop: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  ruleNumTx: { fontSize: 16, fontWeight: 'bold' },
  ruleTx: { color: 'rgba(255,255,255,0.85)', fontSize: 16, flex: 1, lineHeight: 22 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 18, paddingHorizontal: 32,
     width: '100%', maxWidth: 540, alignSelf: 'center',
    marginTop: 18, minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  startBtnTx: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  fullPress: { flex: 1 },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bigText: { color: '#fff', fontSize: 48, fontFamily: 'Viral-Black', letterSpacing: 0.5 },
  bigSub: { color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '600' },
  megaText: {
    color: '#fff',
    fontSize: 140,
    fontFamily: 'Viral-Black',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    fontStyle: 'italic',
  },

  waitText: {
    color: '#fff',
    fontSize: 48,
    fontFamily: 'Viral-Black',
    letterSpacing: 1,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  attemptBadge: {
    position: 'absolute', top: 18, alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  attemptBadgeTx: { color: '#fff', fontSize: 15, fontWeight: '700' },

  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dot: { width: 16, height: 16, borderRadius: 8 },

  attemptList: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 16,
  },
  attemptRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 8,
  },
  attemptIdx: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600' },
  attemptVal: { color: '#fff', fontSize: 18, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  countdownCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(52,199,89,0.2)',
    borderWidth: 2,
    borderColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  countdownNum: {
    color: '#fff',
    fontSize: 44,
    fontFamily: 'Viral-Black',
  },
  waitingSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 16,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  waitingBoxText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
});
