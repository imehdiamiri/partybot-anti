import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, cancelAnimation } from 'react-native-reanimated';
import { Colors } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props { session: GameSession; }

type Phase = 'ready' | 'waiting' | 'go' | 'tapped' | 'foul' | 'playerComplete' | 'results';

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
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState<number>(0);
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

  useEffect(() => {
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
  }, [phase, playerIdx, player]);

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

  const handleScreenPress = () => {
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

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // ─── READY ───
  if (phase === 'ready') {
    const isFirstPlayer = playerIdx === 0;
    
    if (!isFirstPlayer) {
      return (
        <PhaseTransition phaseKey={phase} style={{ flex: 1 }}>
          <GamePassPhoneView
            playerName={player?.displayName || 'Player'}
            title={`PLAYER ${playerIdx + 1} OF ${players.length}`}
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

    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <ScrollView contentContainerStyle={st.readyContent}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <IconSymbol name="bolt.fill" size={64} color={Colors.green} />
          </View>
          <Text style={st.eyebrow}>REACTION TIME</Text>
          <Text style={st.nameTitle} numberOfLines={2}>{player?.displayName ?? 'Player'}</Text>
          <View style={st.pill}>
            <Text style={st.pillTx}>Are you ready?</Text>
          </View>

          <Pressable style={[st.startBtn, { backgroundColor: Colors.green }]} onPress={beginAttempt}>
            <IconSymbol name="play.fill" size={24} color="#fff" />
            <Text style={st.startBtnTx}>I{"'"}m Ready</Text>
          </Pressable>
        </ScrollView>
      </PhaseTransition>
    );
  }

  // ─── WAITING (RED) ───
  if (phase === 'waiting') {
    return (
      <Pressable style={[st.fullPress, { backgroundColor: Colors.red }]} onPress={handleScreenPress}>
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
      <Pressable style={[st.fullPress, { backgroundColor: Colors.green }]} onPress={handleScreenPress}>
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
          <Pressable style={[st.startBtn, { backgroundColor: '#007AFF' }]} onPress={continueAfterAttempt}>
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
          <Pressable style={[st.startBtn, { backgroundColor: Colors.orange }]} onPress={continueAfterAttempt}>
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
      primary: row.best == null ? '—' : `${row.best} ms`,
      secondary: attemptsSummary(row.record.attempts),
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
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
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
    borderRadius: 16, width: '100%',
    marginTop: 18,
  },
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
});
