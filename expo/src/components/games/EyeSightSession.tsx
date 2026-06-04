import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors, Typography } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Delete, Check } from 'lucide-react-native';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import * as Haptics from '@/src/utils/safeHaptics';
import { AudioManager } from '@/src/services/AudioManager';
import { PhaseTransition } from './PhaseTransition';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';

interface Props { session: GameSession; }

type Phase =
  | 'difficulty'
  | 'ready'
  | 'countdown'
  | 'flash'
  | 'input'
  | 'correct'
  | 'wrong'
  | 'playerComplete'
  | 'results';

interface PlayerRecord {
  playerId: string;
  bestRound: number;
  bestDigits: number;
}

const ACCENT = '#5AC8FA';

type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert';

interface DifficultyDef {
  id: DifficultyId;
  name: string;
  emoji: string;
  description: string;
  baseDigits: number;
  baseMs: number;
  /** Step (digits added every X rounds). Higher = faster ramp. */
  digitsPerStep: number;
  /** Ms shaved off per round. */
  msStep: number;
  /** Floor for display ms. */
  minMs: number;
  /** Cap for digit count. */
  maxDigits: number;
}

const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'easy',
    name: 'Easy',
    emoji: '🌱',
    description: '3 digits · 1.4s flash · gentle ramp',
    baseDigits: 3,
    baseMs: 1400,
    digitsPerStep: 3,
    msStep: 60,
    minMs: 700,
    maxDigits: 7,
  },
  {
    id: 'medium',
    name: 'Medium',
    emoji: '⚡',
    description: '3 digits · 1.0s flash · steady ramp',
    baseDigits: 3,
    baseMs: 1000,
    digitsPerStep: 2,
    msStep: 70,
    minMs: 500,
    maxDigits: 8,
  },
  {
    id: 'hard',
    name: 'Hard',
    emoji: '🔥',
    description: '4 digits · 0.7s flash · fast ramp',
    baseDigits: 4,
    baseMs: 700,
    digitsPerStep: 2,
    msStep: 60,
    minMs: 350,
    maxDigits: 9,
  },
  {
    id: 'expert',
    name: 'Expert',
    emoji: '👁️',
    description: '5 digits · 0.45s flash · brutal',
    baseDigits: 5,
    baseMs: 450,
    digitsPerStep: 2,
    msStep: 50,
    minMs: 220,
    maxDigits: 10,
  },
];

function roundConfig(def: DifficultyDef, round: number): { digits: number; ms: number } {
  const digits = Math.min(def.maxDigits, def.baseDigits + Math.floor((round - 1) / def.digitsPerStep));
  const ms = Math.max(def.minMs, def.baseMs - (round - 1) * def.msStep);
  return { digits, ms };
}

function generateNumber(digits: number): string {
  let s = '';
  s += String(1 + Math.floor(Math.random() * 9));
  for (let i = 1; i < digits; i++) {
    s += String(Math.floor(Math.random() * 10));
  }
  return s;
}

export function EyeSightSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();
  const { width: screenWidth } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('difficulty');
  const [difficulty, setDifficulty] = useState<DifficultyDef>(DIFFICULTIES[1]!);
  const [playerIdx, setPlayerIdx] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [digits, setDigits] = useState<number>(3);
  const [ms, setMs] = useState<number>(1000);
  const [target, setTarget] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);
  const [records, setRecords] = useState<PlayerRecord[]>(() =>
    players.map(p => ({ playerId: p.id, bestRound: 0, bestDigits: 0 }))
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = players[playerIdx];
  const config = { digits, ms };

  const flashScale = useSharedValue<number>(0.9);
  const flashOpacity = useSharedValue<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Register skip handler during active playing phases
  useEffect(() => {
    if (phase === 'countdown' || phase === 'flash' || phase === 'input' || phase === 'correct' || phase === 'wrong') {
      registerSkip(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const isLast = playerIdx + 1 >= players.length;
        if (isLast) {
          AudioManager.play('gameOver');
          setPhase('results');
        } else {
          setPlayerIdx(playerIdx + 1);
          setRound(1);
          setInput('');
          setTarget('');
          setPhase('ready');
        }
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIdx]);

  /** Auto-shrink flash font so the number stays on a single line at any digit count. */
  const flashFontSize = useMemo(() => {
    const usable = screenWidth - 40;
    // Approx character width factor for bold tabular digits + letterSpacing.
    const perCharFactor = 0.62;
    const ideal = Math.floor(usable / (config.digits * perCharFactor));
    return Math.max(40, Math.min(110, ideal));
  }, [config.digits, screenWidth]);

  const flashLetterSpacing = useMemo(() => (config.digits >= 7 ? 2 : config.digits >= 5 ? 4 : 6), [config.digits]);

  const inputFontSize = useMemo(() => {
    const usable = screenWidth - 80;
    const ideal = Math.floor(usable / (Math.max(config.digits, 3) * 0.7));
    return Math.max(28, Math.min(56, ideal));
  }, [config.digits, screenWidth]);

  const updateBest = useCallback((idx: number, r: number, d: number) => {
    setRecords(prev => {
      const next = [...prev];
      const cur = next[idx];
      if (!cur) return prev;
      if (r > cur.bestRound) {
        next[idx] = { ...cur, bestRound: r, bestDigits: d };
      }
      return next;
    });
  }, []);

  const startRound = useCallback((r: number) => {
    const activeConfig = roundConfig(difficulty, r);
    const num = generateNumber(activeConfig.digits);
    
    // Set all state synchronously
    setRound(r);
    setDigits(activeConfig.digits);
    setMs(activeConfig.ms);
    setTarget(num);
    setInput('');
    setCountdown(3);
    setPhase('countdown');

    if (timerRef.current) clearTimeout(timerRef.current);

    let n = 3;
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        flashScale.value = 0.9;
        flashOpacity.value = 0;
        setPhase('flash');
        flashOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
        flashScale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        AudioManager.play('countdownFinal');
        timerRef.current = setTimeout(() => {
          flashOpacity.value = withTiming(0, { duration: 100 });
          setPhase('input');
        }, activeConfig.ms);
        return;
      }
      setCountdown(n);
      Haptics.selectionAsync();
      AudioManager.play('countdown');
      timerRef.current = setTimeout(tick, 700);
    };
    Haptics.selectionAsync();
    AudioManager.play('countdown');
    timerRef.current = setTimeout(tick, 700);
  }, [difficulty, flashOpacity, flashScale]);

  const submitAnswer = useCallback(() => {
    if (input.length === 0) return;
    if (input === target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioManager.play('success');
      updateBest(playerIdx, round, config.digits);
      setPhase('correct');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      AudioManager.play('wrong');
      setPhase('wrong');
    }
  }, [input, target, playerIdx, round, config.digits, updateBest]);

  const continueAfterCorrect = () => {
    startRound(round + 1);
  };

  const goToNextPlayer = () => {
    const isLast = playerIdx + 1 >= players.length;
    if (isLast) {
      AudioManager.play('gameOver');
      setPhase('results');
    } else {
      AudioManager.play('phaseChange');
      setPlayerIdx(playerIdx + 1);
      setRound(1);
      setInput('');
      setTarget('');
      startRound(1);
    }
  };

  const playAgain = () => {
    AudioManager.play('buttonTap');
    setRecords(players.map(p => ({ playerId: p.id, bestRound: 0, bestDigits: 0 })));
    setPlayerIdx(0);
    setRound(1);
    setInput('');
    setTarget('');
    setPhase('difficulty');
  };

  const onPickDifficulty = (def: DifficultyDef) => {
    Haptics.selectionAsync();
    AudioManager.play('buttonTap');
    setDifficulty(def);
    setPhase('ready');
  };

  const handlePadPress = useCallback((digit: string) => {
    Haptics.selectionAsync();
    AudioManager.play('buttonTap');
    setInput(prev => (prev.length >= config.digits ? prev : prev + digit));
  }, [config.digits]);

  const handlePadDelete = useCallback(() => {
    Haptics.selectionAsync();
    AudioManager.play('buttonTap');
    setInput(prev => prev.slice(0, -1));
  }, []);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  // ─── DIFFICULTY ───
  if (phase === 'difficulty') {
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <ScrollView contentContainerStyle={st.readyContent}>
          <View style={[st.iconBox, { backgroundColor: ACCENT + '26' }]}>
            <IconSymbol name="eye.fill" size={56} color={ACCENT} />
          </View>
          <Text style={st.eyebrow}>EYE SIGHT</Text>
          <Text style={st.title}>Choose your difficulty</Text>
          <Text style={st.sub}>Higher levels show numbers for less time and ramp up faster.</Text>

          <View style={st.diffList}>
            {DIFFICULTIES.map((def) => {
              const selected = def.id === difficulty.id;
              return (
                <Pressable
                  key={def.id}
                  onPress={() => onPickDifficulty(def)}
                  style={[
                    st.diffCard,
                    selected && { borderColor: ACCENT, backgroundColor: ACCENT + '14' },
                  ]}
                >
                  <Text style={st.diffEmoji}>{def.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.diffName}>{def.name}</Text>
                    <Text style={st.diffDesc}>{def.description}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </PhaseTransition>
    );
  }

  // ─── READY ───
  if (phase === 'ready') {
    const isFirstPlayer = playerIdx === 0;

    if (!isFirstPlayer) {
      return (
        <PhaseTransition phaseKey={phase} style={{ flex: 1 }}>
          <GamePassPhoneView
            playerName={player?.displayName || 'Player'}
            title={`PLAYER ${playerIdx + 1} OF ${players.length}`}
            subtitle={`Pass the phone to ${player?.displayName || 'the next player'}. Tap below to start.`}
            accentColor={ACCENT}
            onReady={() => startRound(round)}
            onSkip={() => {
              const isLast = playerIdx + 1 >= players.length;
              if (isLast) {
                AudioManager.play('gameOver');
                setPhase('results');
              } else {
                setPlayerIdx(playerIdx + 1);
                setRound(1);
                setInput('');
                setTarget('');
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
          <View style={[st.iconBox, { backgroundColor: ACCENT + '26' }]}>
            <IconSymbol name="eye.fill" size={56} color={ACCENT} />
          </View>
          <Text style={st.eyebrow}>{isFirstPlayer ? `EYE SIGHT · ${difficulty.name.toUpperCase()}` : `PLAYER ${playerIdx + 1} OF ${players.length}`}</Text>
          <Text style={st.nameTitle} numberOfLines={2}>{player?.displayName ?? 'Player'}</Text>
          <View style={[st.pill, { backgroundColor: ACCENT + '26', borderColor: ACCENT + '4D' }]}>
            <Text style={[st.pillTx, { color: ACCENT }]}>Are you ready?</Text>
          </View>

          <View style={st.rulesCard}>
            <RuleRow num={1} color={ACCENT} text="A countdown of 3, 2, 1 prepares you for the next number." />
            <RuleRow num={2} color={ACCENT} text="A number flashes for a brief moment — watch carefully!" />
            <RuleRow num={3} color={ACCENT} text="Tap the number on the keypad and submit. One wrong answer ends your turn." />
          </View>

          <Pressable style={[st.startBtn, { backgroundColor: ACCENT }]} onPress={() => startRound(round)}>
            <IconSymbol name="play.fill" size={18} color="#fff" />
            <Text style={st.startBtnTx}>I'm Ready</Text>
          </Pressable>
        </ScrollView>
      </PhaseTransition>
    );
  }

  if (phase === 'countdown') {
    return (
      <PhaseTransition phaseKey={phase + countdown} type="scale" style={[st.container, st.fullCenter]}>
        <Text style={st.eyebrow}>ROUND {round} · {config.digits} DIGITS</Text>
        <Text style={st.countdownTx}>{countdown}</Text>
        <Text style={st.bigSub}>Get ready…</Text>

      </PhaseTransition>
    );
  }

  if (phase === 'flash') {
    return (
      <PhaseTransition phaseKey={phase} type="fade" style={[st.container, st.fullCenter]}>
        <Text style={st.eyebrow}>ROUND {round}</Text>
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            st.flashNumber,
            { fontSize: flashFontSize, letterSpacing: flashLetterSpacing },
            flashStyle,
          ]}
        >
          {target}
        </Animated.Text>

      </PhaseTransition>
    );
  }

  if (phase === 'input') {
    const slots: string[] = [];
    for (let i = 0; i < config.digits; i++) slots.push(input[i] ?? '');
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.inputTop}>
          <Text style={st.eyebrow}>ROUND {round} · {config.digits} DIGITS</Text>
          <Text style={st.title}>What did you see?</Text>

          <View style={st.slotRow}>
            {slots.map((ch, i) => {
              const filled = ch.length > 0;
              return (
                <View
                  key={i}
                  style={[
                    st.slot,
                    {
                      width: Math.max(28, Math.min(56, (screenWidth - 40 - (config.digits - 1) * 8) / config.digits)),
                      borderColor: filled ? ACCENT : 'rgba(255,255,255,0.18)',
                      backgroundColor: filled ? ACCENT + '1A' : 'rgba(255,255,255,0.04)',
                    },
                  ]}
                >
                  <Text style={[st.slotTx, { fontSize: inputFontSize }]}>{ch || '·'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <NumberPad
          onDigit={handlePadPress}
          onDelete={handlePadDelete}
          onSubmit={submitAnswer}
          canSubmit={input.length === config.digits}
        />

      </PhaseTransition>
    );
  }

  if (phase === 'correct') {
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <IconSymbol name="checkmark.circle.fill" size={56} color={Colors.green} />
          </View>
          <Text style={st.title}>Correct!</Text>
          <Text style={st.sub}>Round {round} cleared · {config.digits} digits</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[st.title, { color: Colors.green, fontSize: 36, marginTop: 4 }]}
          >
            {target}
          </Text>
          <Pressable style={[st.startBtn, { backgroundColor: ACCENT }]} onPress={continueAfterCorrect}>
            <Text style={st.startBtnTx}>Next Round</Text>
          </Pressable>

        </View>
      </PhaseTransition>
    );
  }

  if (phase === 'wrong') {
    const rec = records[playerIdx];
    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,59,48,0.18)' }]}>
            <IconSymbol name="xmark.octagon.fill" size={56} color={Colors.red} />
          </View>
          <Text style={st.title}>Not quite!</Text>
          <Text style={st.sub}>The number was</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[st.title, { color: Colors.red, fontSize: 36, marginTop: 2 }]}
          >
            {target}
          </Text>
          <Text style={[st.sub, { marginTop: 6 }]}>You typed {input || '—'}</Text>

          <View style={st.attemptList}>
            <View style={st.attemptRow}>
              <Text style={st.attemptIdx}>Best round</Text>
              <Text style={st.attemptVal}>{rec?.bestRound ?? 0}</Text>
            </View>
            <View style={st.attemptRow}>
              <Text style={st.attemptIdx}>Top digits</Text>
              <Text style={st.attemptVal}>{rec?.bestDigits ?? 0}</Text>
            </View>
          </View>

          <Pressable style={[st.startBtn, { backgroundColor: ACCENT }]} onPress={() => setPhase('playerComplete')}>
            <Text style={st.startBtnTx}>Continue</Text>
          </Pressable>

        </View>
      </PhaseTransition>
    );
  }

  if (phase === 'playerComplete') {
    const rec = records[playerIdx];
    const isLast = playerIdx + 1 >= players.length;
    return (
      <GamePlayerCompleteView
        nextPlayerName={isLast ? '' : (players[playerIdx + 1]?.displayName ?? 'Next Player')}
        prevResultLine={`Best round: ${rec?.bestRound ?? 0} · Top digits: ${rec?.bestDigits ?? 0}`}
        onReady={goToNextPlayer}
        accentColor={ACCENT}
      />
    );
  }

  // ─── RESULTS ───
  const entries: RankEntry[] = [...records]
    .map(r => {
      const p = players.find(pp => pp.id === r.playerId);
      return { record: r, name: p?.displayName ?? 'Player' };
    })
    .sort((a, b) => {
      if (a.record.bestRound !== b.record.bestRound) return b.record.bestRound - a.record.bestRound;
      return b.record.bestDigits - a.record.bestDigits;
    })
    .map((row): RankEntry => ({
      id: row.record.playerId,
      name: row.name,
      primary: `Round ${row.record.bestRound}`,
      secondary: `${row.record.bestDigits} digits`,
    }));

  return (
    <PhaseTransition phaseKey={phase} style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Your Result'}
          subtitle={`Highest round wins · ${difficulty.name}`}
          onPlayAgain={playAgain}
          shareGameName="Eye Sight"
        />
      </ScrollView>
    </PhaseTransition>
  );
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

interface NumberPadProps {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

function NumberPad({ onDigit, onDelete, onSubmit, canSubmit }: NumberPadProps) {
  const rows: (string | 'del' | 'submit')[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['del', '0', 'submit'],
  ];
  return (
    <View style={st.pad}>
      {rows.map((row, ri) => (
        <View key={ri} style={st.padRow}>
          {row.map((cell) => {
            if (cell === 'del') {
              return (
                <Pressable key="del" onPress={onDelete} style={[st.padKey, st.padKeyDim]}>
                  <Delete size={26} color="#fff" strokeWidth={2.2} />
                </Pressable>
              );
            }
            if (cell === 'submit') {
              return (
                <Pressable
                  key="submit"
                  onPress={onSubmit}
                  disabled={!canSubmit}
                  style={[
                    st.padKey,
                    {
                      backgroundColor: canSubmit ? ACCENT : 'rgba(90,200,250,0.25)',
                    },
                  ]}
                >
                  <Check size={28} color="#fff" strokeWidth={3} />
                </Pressable>
              );
            }
            return (
              <Pressable key={cell} onPress={() => onDigit(cell)} style={st.padKey}>
                <Text style={st.padKeyTx}>{cell}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  iconBox: {
    width: 100, height: 100, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 34, fontFamily: 'Viral-Black', textAlign: 'center' },
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
    fontSize: 44,
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
  handoffTx: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 20, lineHeight: 28, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'center', fontWeight: '500' },
  bigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontFamily: 'Viral-Black' },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillTx: { fontSize: 16, fontFamily: 'Viral-Black' },

  rulesCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 12, marginTop: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  ruleNumTx: { fontSize: 16, fontFamily: 'Viral-Black' },
  ruleTx: { color: 'rgba(255,255,255,0.85)', fontSize: 16, flex: 1, lineHeight: 24 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 18, width: '100%',
    marginTop: 18,
  },
  startBtnTx: { color: '#fff', fontSize: 18, fontFamily: 'Viral-Black' },

  countdownTx: {
    color: '#fff',
    fontSize: 140,
    fontFamily: 'Viral-Black',
    letterSpacing: 2,
    textShadowColor: 'rgba(90,200,250,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  flashNumber: {
    color: '#fff',
    fontFamily: 'Viral-Black',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(90,200,250,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 32,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  diffList: { width: '100%', gap: 10, marginTop: 6 },
  diffCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  diffEmoji: { fontSize: 36 },
  diffName: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black', marginBottom: 2 },
  diffDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },

  inputTop: {
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  slot: {
    aspectRatio: 0.85,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  slotTx: {
    color: '#fff',
    fontFamily: 'Viral-Black',
    fontVariant: ['tabular-nums'],
  },

  pad: {
    marginTop: 'auto',
    paddingHorizontal: 10,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 8,
  },
  padRow: {
    flexDirection: 'row',
    gap: 8,
  },
  padKey: {
    flex: 1,
    aspectRatio: 1.65,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  padKeyDim: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  padKeyTx: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Viral-Black',
    fontVariant: ['tabular-nums'],
  },

  attemptList: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 12, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 16,
  },
  attemptRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  attemptIdx: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  attemptVal: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
});
