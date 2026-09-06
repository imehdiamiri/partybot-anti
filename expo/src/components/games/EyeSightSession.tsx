import { useGameActivity, GAME_UI } from './GameActivity';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { compareEyeSightDigits, EyeSightAttempt } from '@/src/utils/eyeSightFeedback';
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
  attempts: EyeSightAttempt[];
  skipped?: boolean;
}

const ACCENT = '#5AC8FA';
const NUMBER_FONT = Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'ui-monospace, SFMono-Regular, Consolas, monospace';

import { DIFFICULTIES, DifficultyDef } from '@/src/constants/EyeSightDifficulty';

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
  const [phase, setPhase] = useState<Phase>('ready');
  const difficulty = DIFFICULTIES.find(d => d.id === session.gameConfig?.difficulty) || DIFFICULTIES[1]!;
  const [playerIdx, setPlayerIdx] = useState<number>(0);
  useGameActivity(players[playerIdx]?.displayName, phase);
  const [round, setRound] = useState<number>(1);
  const [digits, setDigits] = useState<number>(3);
  const [ms, setMs] = useState<number>(1000);
  const [target, setTarget] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);
  const [records, setRecords] = useState<PlayerRecord[]>(() =>
    players.map(p => ({ playerId: p.id, bestRound: 0, bestDigits: 0, attempts: [] }))
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
        setRecords(prev => prev.map((rec, index) => index === playerIdx ? { ...rec, skipped: true } : rec));
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
    const usable = Math.min(screenWidth, 540) - 64 - config.digits * 2;
    // Approx character width factor for bold tabular digits + letterSpacing.
    const perCharFactor = 0.62;
    const ideal = Math.floor(usable / (config.digits * perCharFactor));
    return Math.max(22, Math.min(100, ideal));
  }, [config.digits, screenWidth]);

  const flashLetterSpacing = 2;

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
    if (phase !== 'input' || input.length !== target.length) return;
    setRecords(prev => prev.map((rec, index) => index === playerIdx
      ? { ...rec, attempts: [...rec.attempts, { round, target, answer: input, correct: input === target }] }
      : rec));
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
  }, [phase, input, target, playerIdx, round, config.digits, updateBest]);

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
    setRecords(players.map(p => ({ playerId: p.id, bestRound: 0, bestDigits: 0, attempts: [] })));
    setPlayerIdx(0);
    setRound(1);
    setInput('');
    setTarget('');
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

  // ─── READY ───
  if (phase === 'ready') {
    return (
      <PhaseTransition phaseKey={`ready-${playerIdx}`} style={{ flex: 1 }}>
        <GamePassPhoneView
          playerName={player?.displayName || 'Player'}
          title={players.length > 1 && playerIdx > 0 ? "Pass the phone to" : "Get ready"}
          subtitle={`Eye Sight · ${difficulty.name} · Flash memory test`}
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
                      width: Math.max(18, Math.min(56, (Math.min(screenWidth, 540) - 40 - (config.digits - 1) * 4) / config.digits)),
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

  if (phase === 'correct' || phase === 'wrong') {
    const attempts = records[playerIdx]?.attempts ?? [];
    const correctCount = attempts.filter(attempt => attempt.correct).length;
    const isCorrect = phase === 'correct';
    return (
      <ScrollView style={st.container} contentContainerStyle={st.feedbackContent}>
        <Text style={st.eyebrow}>ROUND {round}</Text>
        <Text style={[st.sub, { color: '#68E8A8', fontSize: 22, fontWeight: '800' }]}>{player?.displayName}</Text>
        <Text style={st.title}>{isCorrect ? 'Correct!' : 'Turn complete'}</Text>
        <Text style={st.sub}>{attempts.length} attempts · {correctCount} correct · {attempts.length - correctCount} wrong</Text>
        <View style={st.comparisonCard}>
          <Text style={st.comparisonLabel}>Original number</Text>
          <Text testID="eyesight-original" adjustsFontSizeToFit numberOfLines={1} style={st.originalNumber}>{target}</Text>
          <Text style={st.comparisonLabel}>Your answer</Text>
          <View style={st.digitComparison}>
            {compareEyeSightDigits(target, input).map((digit, index) => <View key={index} style={st.comparisonDigit}>
              <Text testID={`eyesight-answer-digit-${index}`} accessibilityLabel={`Digit ${index + 1}: ${digit.entered}, ${digit.correct ? 'correct' : 'wrong, expected ' + digit.expected}`}
                style={[st.answerDigit, { color: digit.correct ? '#72e3a1' : '#ff7676' }]}>{digit.entered}</Text>
              <Text style={{ color: digit.correct ? '#72e3a1' : '#ff7676', fontSize: 14 }}>{digit.correct ? '✓' : '×'}</Text>
            </View>)}
          </View>
          <Text style={st.sub}>{isCorrect ? 'Every digit matches. Ready for a harder round?' : 'Red × marks a wrong digit. One wrong answer ends your turn.'}</Text>
        </View>
        <Pressable testID={isCorrect ? 'eyesight-next-round-button' : 'eyesight-continue-button'} style={[st.startBtn, { backgroundColor: ACCENT }]}
          onPress={isCorrect ? continueAfterCorrect : () => setPhase('playerComplete')}>
          <Text style={st.startBtnTx}>{isCorrect ? 'Next Round' : 'Continue'}</Text>
        </Pressable>
        <View style={st.attemptList}>
          <Text style={st.comparisonLabel}>Round history · original → your answer</Text>
          {[...attempts].reverse().map(attempt => <View key={attempt.round} style={st.historyRow}>
            <Text style={st.historyLabel}>R{attempt.round} {attempt.correct ? '✓' : '×'}</Text>
            <View style={st.historyNumbers}>
              <Text style={st.historyNumber}>{attempt.target} → </Text>
              <Text style={st.historyNumber}>{compareEyeSightDigits(attempt.target, attempt.answer).map((digit, index) =>
                <Text key={index} style={{ color: digit.correct ? '#72e3a1' : '#ff7676' }}>{digit.entered}</Text>)}</Text>
            </View>
          </View>)}
        </View>
      </ScrollView>
    );
  }

  if (phase === 'playerComplete') {
    const rec = records[playerIdx];
    const isLast = playerIdx + 1 >= players.length;
    return (
      <GamePlayerCompleteView
        prevPlayerName={player?.displayName}
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
      const isSkipped = !!r.skipped || r.attempts.length === 0;
      return { record: r, isSkipped, name: p?.displayName ?? 'Player' };
    })
    .sort((a, b) => {
      if (a.isSkipped !== b.isSkipped) return a.isSkipped ? 1 : -1;
      if (a.record.bestRound !== b.record.bestRound) return b.record.bestRound - a.record.bestRound;
      return b.record.bestDigits - a.record.bestDigits;
    })
    .map((row): RankEntry => ({
      id: row.record.playerId,
      name: row.name,
      isSkipped: row.isSkipped,
      primary: row.isSkipped ? 'Skipped' : `Round ${row.record.bestRound}`,
      secondary: row.isSkipped ? 'Skipped turn' : `${row.record.attempts.length} attempts · ${row.record.bestDigits} digits`,
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
                <Pressable key="del" testID="eyesight-key-del" accessibilityRole="button" onPress={onDelete} style={[st.padKey, st.padKeyDim]}>
                  <Delete size={26} color="#fff" strokeWidth={2.2} />
                </Pressable>
              );
            }
            if (cell === 'submit') {
              return (
                <Pressable
                  key="submit"
                  testID="eyesight-key-submit"
                  accessibilityRole="button"
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
              <Pressable key={cell} testID={`eyesight-key-${cell}`} accessibilityRole="button" onPress={() => onDigit(cell)} style={st.padKey}>
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
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14, maxWidth: 540, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, maxWidth: 540, width: '100%', alignSelf: 'center' },
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
     width: '100%', maxWidth: 540, alignSelf: 'center',
    marginTop: 18, minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  startBtnTx: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

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
    fontFamily: NUMBER_FONT,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  diffList: { width: '100%', gap: 10, marginTop: 6, maxWidth: 540, alignSelf: 'center' },
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
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    gap: 4,
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
    fontFamily: NUMBER_FONT,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

  pad: {
    marginTop: 'auto',
    paddingHorizontal: 10,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 8,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
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
    fontFamily: NUMBER_FONT,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

  feedbackContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 12, width: '100%', maxWidth: 540, alignSelf: 'center' },
  comparisonCard: { width: '100%', padding: 16, gap: 14, borderRadius: 20, backgroundColor: '#151923', alignItems: 'center' },
  comparisonLabel: { color: '#dce3f2', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  originalNumber: { fontFamily: NUMBER_FONT, fontWeight: '500', color: '#fff', fontSize: 34, textAlign: 'center', width: '100%' },
  digitComparison: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  comparisonDigit: { flex: 1, maxWidth: 44, alignItems: 'center', gap: 4 },
  answerDigit: { fontFamily: NUMBER_FONT, fontWeight: '500', fontSize: 26 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  historyLabel: { color: '#aeb8cb', fontSize: 13, width: 42 },
  historyNumbers: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  historyNumber: { color: '#fff', fontSize: 16, fontFamily: NUMBER_FONT },
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
