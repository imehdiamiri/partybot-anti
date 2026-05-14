import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Delete, Check } from 'lucide-react-native';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import * as Haptics from '@/src/utils/safeHaptics';
import { AudioManager } from '@/src/services/AudioManager';

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
  const { width: screenWidth } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('difficulty');
  const [difficulty, setDifficulty] = useState<DifficultyDef>(DIFFICULTIES[1]!);
  const [playerIdx, setPlayerIdx] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [target, setTarget] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);
  const [records, setRecords] = useState<PlayerRecord[]>(() =>
    players.map(p => ({ playerId: p.id, bestRound: 0, bestDigits: 0 }))
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = players[playerIdx];
  const config = roundConfig(difficulty, round);

  const flashScale = useSharedValue<number>(0.9);
  const flashOpacity = useSharedValue<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

  const startCountdown = useCallback(() => {
    setInput('');
    setPhase('countdown');
    setCountdown(3);
    let n = 3;
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        const num = generateNumber(config.digits);
        setTarget(num);
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
        }, config.ms);
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
  }, [config.digits, config.ms, flashOpacity, flashScale]);

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
    setRound(round + 1);
    startCountdown();
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
      setPhase('ready');
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
      <View style={st.container}>
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
      </View>
    );
  }

  // ─── READY ───
  if (phase === 'ready') {
    const isFirstPlayer = playerIdx === 0;
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={st.readyContent}>
          <View style={[st.iconBox, { backgroundColor: ACCENT + '26' }]}>
            <IconSymbol name="eye.fill" size={56} color={ACCENT} />
          </View>
          <Text style={st.eyebrow}>{isFirstPlayer ? `EYE SIGHT · ${difficulty.name.toUpperCase()}` : `PLAYER ${playerIdx + 1} OF ${players.length}`}</Text>
          <Text style={st.nameTitle} numberOfLines={2}>{player?.displayName ?? 'Player'}</Text>
          <View style={[st.pill, { backgroundColor: ACCENT + '26', borderColor: ACCENT + '4D' }]}>
            <Text style={[st.pillTx, { color: ACCENT }]}>Are you ready?</Text>
          </View>

          {!isFirstPlayer && (
            <View style={st.handoffCard}>
              <IconSymbol name="hand.raised.fill" size={22} color={Colors.cyan} />
              <Text style={st.handoffTx}>Pass the phone to {player?.displayName}. Tap below to start.</Text>
            </View>
          )}

          <View style={st.rulesCard}>
            <RuleRow num={1} color={ACCENT} text="A countdown of 3, 2, 1 prepares you for the next number." />
            <RuleRow num={2} color={ACCENT} text="A number flashes for a brief moment — watch carefully!" />
            <RuleRow num={3} color={ACCENT} text="Tap the number on the keypad and submit. One wrong answer ends your turn." />
          </View>

          <Pressable style={[st.startBtn, { backgroundColor: ACCENT }]} onPress={startCountdown}>
            <IconSymbol name="play.fill" size={18} color="#fff" />
            <Text style={st.startBtnTx}>I&apos;m Ready</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── COUNTDOWN ───
  if (phase === 'countdown') {
    return (
      <View style={[st.container, st.fullCenter]}>
        <Text style={st.eyebrow}>ROUND {round} · {config.digits} DIGITS</Text>
        <Text style={st.countdownTx}>{countdown}</Text>
        <Text style={st.bigSub}>Get ready…</Text>
      </View>
    );
  }

  // ─── FLASH ───
  if (phase === 'flash') {
    return (
      <View style={[st.container, st.fullCenter]}>
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
      </View>
    );
  }

  // ─── INPUT ───
  if (phase === 'input') {
    const slots: string[] = [];
    for (let i = 0; i < config.digits; i++) slots.push(input[i] ?? '');
    return (
      <View style={st.container}>
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
      </View>
    );
  }

  // ─── CORRECT ───
  if (phase === 'correct') {
    return (
      <View style={st.container}>
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
      </View>
    );
  }

  // ─── WRONG ───
  if (phase === 'wrong') {
    const rec = records[playerIdx];
    return (
      <View style={st.container}>
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
      </View>
    );
  }

  // ─── PLAYER COMPLETE ───
  if (phase === 'playerComplete') {
    const rec = records[playerIdx];
    const isLast = playerIdx + 1 >= players.length;
    return (
      <View style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,204,0,0.18)' }]}>
            <IconSymbol name="trophy.fill" size={48} color={Colors.yellow} />
          </View>
          <Text style={st.title}>{player?.displayName}</Text>
          <Text style={st.sub}>Best round</Text>
          <Text style={[st.title, { color: ACCENT, fontSize: 56, marginTop: 4 }]}>{rec?.bestRound ?? 0}</Text>
          <Text style={st.sub}>Top digit count: {rec?.bestDigits ?? 0}</Text>
          <Pressable style={[st.startBtn, { backgroundColor: Colors.green }]} onPress={goToNextPlayer}>
            <Text style={st.startBtnTx}>{isLast ? 'See Final Rankings' : 'Next Player'}</Text>
          </Pressable>
        </View>
      </View>
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
    <View style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Your Result'}
          subtitle={`Highest round wins · ${difficulty.name}`}
          onPlayAgain={playAgain}
          shareGameName="Eye Sight"
        />
      </ScrollView>
    </View>
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
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    textAlign: 'center',
    marginTop: 4,
  },
  nameTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
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
  handoffTx: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 19, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' },
  bigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillTx: { fontSize: 13, fontWeight: '700' },

  rulesCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 12, marginTop: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  ruleNumTx: { fontSize: 14, fontWeight: 'bold' },
  ruleTx: { color: 'rgba(255,255,255,0.85)', fontSize: 14, flex: 1, lineHeight: 19 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 16, width: '100%',
    marginTop: 18,
  },
  startBtnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  countdownTx: {
    color: '#fff',
    fontSize: 140,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(90,200,250,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  flashNumber: {
    color: '#fff',
    fontWeight: '900',
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
  diffEmoji: { fontSize: 30 },
  diffName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  diffDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

  inputTop: {
    paddingTop: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
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
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  slotTx: {
    color: '#fff',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  pad: {
    marginTop: 'auto',
    padding: 12,
    gap: 10,
  },
  padRow: {
    flexDirection: 'row',
    gap: 10,
  },
  padKey: {
    flex: 1,
    aspectRatio: 1.7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  padKeyDim: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  padKeyTx: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
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
  attemptIdx: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  attemptVal: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
});
