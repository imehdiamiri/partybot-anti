import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { PhaseTransition } from './PhaseTransition';
import { GamePassPhoneView, GameReadyScreen, GameOutcomeCard, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { ResultsScoreboard } from './ResultsScoreboard';

interface Props { session: GameSession; }
type Phase = 'ready' | 'preview' | 'playing' | 'outcome' | 'playerComplete' | 'results';
interface PlayerResult { playerId: string; missTaps: number; timeMs: number; correctCount: number; totalTargets: number; didFinish: boolean; }

const DEFAULT_GRID = 5;
const DEFAULT_TILES = 8;

function getConfig(session: GameSession) {
  const g = session.gameConfig?.gridSize ?? DEFAULT_GRID;
  const t = session.gameConfig?.tileCount ?? DEFAULT_TILES;
  return { gridSize: g as number, tileCount: t as number };
}

// Matches iOS: max(4.0, 3.5 + tileCount * 0.35)
function previewDuration(tileCount: number): number {
  return Math.max(4.0, 3.5 + tileCount * 0.35);
}

export function TapInOrderSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const { gridSize: GRID_SIZE, tileCount: TILE_COUNT } = getConfig(session);
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIndex, setPlayerIndex] = useState(0);

  // Board state
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [numberForCell, setNumberForCell] = useState<Record<number, number>>({});
  const [tappedCells, setTappedCells] = useState<Set<number>>(new Set());
  const [nextExpected, setNextExpected] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [missTaps, setMissTaps] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);

  // Timers
  const [elapsed, setElapsed] = useState(0);
  const [previewLeft, setPreviewLeft] = useState(0);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const players = session.players;
  const player = players[playerIndex];
  const totalTargets = selectedCells.length;
  const progressVal = totalTargets > 0 ? correctCount / totalTargets : 0;

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'preview' && previewLeft > 0) {
      // Start smooth progress animation for the full preview duration
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: previewTotal * 1000,
        useNativeDriver: false,
      }).start();

      previewRef.current = setInterval(() => {
        setPreviewLeft(prev => {
          const next = +(prev - 0.1).toFixed(1);
          if (next <= 0) {
            setPhase('playing');
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => { if (previewRef.current) clearInterval(previewRef.current); };
  }, [phase]);

  // Play timer
  useEffect(() => {
    if (phase === 'playing') {
      progressAnim.setValue(0);
      timerRef.current = setInterval(() => setElapsed(p => +(p + 0.1).toFixed(1)), 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'preview' || phase === 'playing') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (previewRef.current) clearInterval(previewRef.current);
        setResults(prev => [...prev, {
          playerId: player.id,
          missTaps: 0,
          timeMs: 0,
          correctCount: 0,
          totalTargets: TILE_COUNT,
          didFinish: false,
        }]);
        const nextIdx = playerIndex + 1;
        if (nextIdx >= players.length) {
          setPhase('results');
        } else {
          setPlayerIndex(nextIdx);
          setPhase('ready');
        }
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIndex, player, players.length, TILE_COUNT]);

  const generateBoard = () => {
    // Pick TILE_COUNT random cells from GRID_SIZE*GRID_SIZE
    const total = GRID_SIZE * GRID_SIZE;
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const cells = indices.slice(0, TILE_COUNT);
    setSelectedCells(cells);

    const mapping: Record<number, number> = {};
    cells.forEach((cell, i) => { mapping[cell] = i + 1; });
    setNumberForCell(mapping);

    setTappedCells(new Set());
    setNextExpected(1);
    setCorrectCount(0);
    setMissTaps(0);
    setElapsed(0);
    setWrongFlash(null);
    setGaveUp(false);

    const dur = previewDuration(TILE_COUNT);
    setPreviewTotal(dur);
    setPreviewLeft(dur);
    progressAnim.setValue(0);
  };

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    generateBoard();
    setPhase('preview');
  };

  const handleTap = (cellIndex: number) => {
    if (phase !== 'playing') return;
    if (tappedCells.has(cellIndex)) return;

    const num = numberForCell[cellIndex];
    if (num === nextExpected) {
      // Correct
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newTapped = new Set(tappedCells);
      newTapped.add(cellIndex);
      setTappedCells(newTapped);
      setNextExpected(prev => prev + 1);
      const newCorrect = correctCount + 1;
      setCorrectCount(newCorrect);

      if (newCorrect >= totalTargets) {
        handleComplete(true);
      } else {
        // Smooth animate progress for playing phase
        Animated.timing(progressAnim, {
          toValue: newCorrect / totalTargets,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    } else {
      // Wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMissTaps(prev => prev + 1);
      setWrongFlash(cellIndex);
      setTimeout(() => setWrongFlash(null), 300);
    }
  };

  const handleGiveUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGaveUp(true);
    handleComplete(false);
  };

  const handleComplete = (didWin: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewRef.current) clearInterval(previewRef.current);

    setResults(prev => [...prev, {
      playerId: player.id, missTaps, timeMs: elapsed * 1000,
      correctCount, totalTargets, didFinish: didWin,
    }]);

    setPhase('outcome');
    setTimeout(() => {
      const nextIdx = playerIndex + 1;
      if (nextIdx >= players.length) setPhase('results');
      else setPhase('playerComplete');
    }, 1800);
  };

  const formatTime = (s: number) => {
    const secs = Math.floor(s);
    const tenths = Math.floor((s * 10) % 10);
    return `${secs}.${tenths}`;
  };

  const sw = Dimensions.get('window').width;
  const spacing = 6;
  const gridW = Math.min(sw - 48, 340);
  const tileSz = (gridW - spacing * (GRID_SIZE - 1)) / GRID_SIZE;

  // ──── READY ────
  if (phase === 'ready') {
    return (
      <GamePassPhoneView
        playerName={player?.displayName || 'Player'}
        title={players.length > 1 && playerIndex > 0 ? "Pass the phone to" : "Get ready"}
        subtitle={`Tap in Order · ${GRID_SIZE}×${GRID_SIZE} grid · ${TILE_COUNT} tiles`}
        accentColor={Colors.orange}
        onReady={handleStart}
        onSkip={() => {
          setResults(prev => [...prev, {
            playerId: player.id,
            missTaps: 0,
            timeMs: 0,
            correctCount: 0,
            totalTargets: TILE_COUNT,
            didFinish: false,
          }]);
          const nextIdx = playerIndex + 1;
          if (nextIdx >= players.length) {
            setPhase('results');
          } else {
            setPlayerIndex(nextIdx);
          }
        }}
      />
    );
  }

  // ──── OUTCOME OVERLAY ────
  if (phase === 'outcome') {
    const accent = gaveUp ? Colors.orange : Colors.green;
    const icon = gaveUp ? 'flag.fill' : 'checkmark.seal.fill';
    const label = gaveUp ? 'Gave Up' : 'Done!';
    return (
      <GameOutcomeCard
        icon={icon}
        label={label}
        sublabel={`${missTaps} mistakes · ${formatTime(elapsed)}s`}
        accentColor={accent}
      />
    );
  }

  // ──── PLAYER COMPLETE (pass phone) ────
  if (phase === 'playerComplete') {
    const lastResult = results[results.length - 1];
    return (
      <GamePlayerCompleteView
        nextPlayerName={players[playerIndex + 1]?.displayName || 'Next Player'}
        prevResultLine={lastResult ? `${lastResult.correctCount}/${lastResult.totalTargets} correct · ${lastResult.missTaps} mistakes · ${(lastResult.timeMs / 1000).toFixed(1)}s` : undefined}
        onReady={() => { setPlayerIndex(i => i + 1); handleStart(); }}
        accentColor={Colors.orange}
      />
    );
  }

  // ──── PREVIEW / PLAYING ────
  if (phase === 'preview' || phase === 'playing') {
    const isPreview = phase === 'preview';
    const previewProgress = isPreview ? 1.0 - (previewLeft / previewTotal) : progressVal;

    return (
      <PhaseTransition phaseKey={`play-${phase}-${playerIndex}`} type="fade" style={st.container}>
        {/* Header */}
        <View style={st.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={st.hName}>{player.displayName}</Text>
            <Text style={st.hSub}>
              {isPreview ? 'Memorize the numbers...' : `Next: ${nextExpected} · ${missTaps} mistakes`}
            </Text>
          </View>
        </View>

        {/* Stats row - matches iOS statCard layout */}
        <View style={st.statsRow}>
          <View style={[st.statCard, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
            <View style={st.statCardInner}>
              <IconSymbol name="xmark.circle.fill" size={12} color={Colors.red} />
              <Text style={[st.statVal, { color: Colors.red }]}>{missTaps}</Text>
            </View>
            <Text style={st.statLbl}>Mistakes</Text>
          </View>
          <View style={[st.statCard, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
            <View style={st.statCardInner}>
              <IconSymbol name="checkmark.seal.fill" size={12} color={Colors.green} />
              <Text style={[st.statVal, { color: Colors.green }]}>{correctCount}/{totalTargets}</Text>
            </View>
            <Text style={st.statLbl}>Correct</Text>
          </View>
          <View style={[st.statCard, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
            <View style={st.statCardInner}>
              <IconSymbol name={isPreview ? 'eye.fill' : 'timer'} size={12} color={Colors.orange} />
              <Text style={[st.statVal, { color: Colors.orange }]}>
                {isPreview ? previewLeft.toFixed(1) : formatTime(elapsed)}
              </Text>
            </View>
            <Text style={st.statLbl}>{isPreview ? 'Preview' : 'Time'}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={st.progWrap}>
          <View style={st.progBg}>
            <Animated.View style={[st.progFill, {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['1%', '100%'],
              }),
              backgroundColor: isPreview ? undefined : Colors.green,
            }]}>
              {isPreview && (
                <LinearGradient colors={[Colors.orange,'#FF2D55']} start={{x:0,y:0}} end={{x:1,y:0}}
                  style={{ flex: 1, borderRadius: 3 }} />
              )}
            </Animated.View>
          </View>
        </View>

        {/* Grid */}
        <View style={[st.gridWrap, { width: gridW }]}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
            const isSelected = selectedCells.includes(idx);
            const isTapped = tappedCells.has(idx);
            const isWrong = wrongFlash === idx;
            const num = numberForCell[idx];
            const tappedCorrect = isTapped && num !== undefined;
            const tappedWrongPersist = isTapped && !isSelected;

            let colors: [string, string] = ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)'];
            let borderColor = 'rgba(255,255,255,0.2)';
            let numColor = 'rgba(255,255,255,0.8)';

            if (isPreview && isSelected) {
              colors = ['rgba(255,149,0,0.55)', 'rgba(255,149,0,0.3)'];
              borderColor = 'rgba(255,149,0,0.6)';
              numColor = 'white';
            } else if (tappedCorrect) {
              colors = ['rgba(52,199,89,0.55)', 'rgba(52,199,89,0.3)'];
              borderColor = 'rgba(52,199,89,0.6)';
              numColor = 'white';
            } else if (tappedWrongPersist) {
              colors = ['rgba(255,59,48,0.45)', 'rgba(255,59,48,0.22)'];
              borderColor = 'rgba(255,59,48,0.5)';
            }
            if (isWrong) borderColor = 'rgba(255,59,48,1)';

            return (
              <Pressable key={idx} onPress={() => handleTap(idx)}
                disabled={isPreview || isTapped}
                style={{ width: tileSz, height: tileSz }}>
                <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:1}}
                  style={[st.tile, { borderColor }, isWrong && { transform: [{ scale: 0.92 }] }]}>
                  {isPreview && num !== undefined && (
                    <Text style={[st.tileNum, { color: numColor }]}>{num}</Text>
                  )}
                  {!isPreview && tappedCorrect && num !== undefined && (
                    <Text style={[st.tileNum, { color: numColor, fontSize: 20 }]}>{num}</Text>
                  )}
                  {!isPreview && tappedWrongPersist && (
                    <IconSymbol name="xmark" size={18} color="rgba(255,255,255,0.8)" />
                  )}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {/* Give Up button */}
        {phase === 'playing' && (
          <Pressable style={st.giveUp} onPress={handleGiveUp}>
            <IconSymbol name="flag.fill" size={14} color={Colors.red} />
            <Text style={st.giveUpTx}>Give Up</Text>
          </Pressable>
        )}

      </PhaseTransition>
    );
  }

  // ──── RESULTS ────
  const sorted = [...results].sort((a, b) => {
    if (a.didFinish !== b.didFinish) return a.didFinish ? -1 : 1;
    if (a.missTaps !== b.missTaps) return a.missTaps - b.missTaps;
    return a.timeMs - b.timeMs;
  });

  return (
    <PhaseTransition phaseKey="results" type="fade" style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={sorted.map(r => {
            const p = players.find(x => x.id === r.playerId);
            const displayTime = (r.timeMs / 1000).toFixed(1);
            return {
              id: r.playerId,
              name: p?.displayName ?? 'Player',
              primary: r.didFinish ? `${displayTime}s` : 'DNF',
              secondary: `${r.correctCount}/${r.totalTargets} correct · ${r.missTaps} mistakes`,
            };
          })}
          title={players.length > 1 ? 'Final Rankings' : 'Complete!'}
          subtitle={players.length > 1 ? undefined : 'Well done!'}
          shareGameName="Tap In Order"
          onPlayAgain={() => {
            setPlayerIndex(0);
            setResults([]);
            setPhase('ready');
          }}
          playAgainTitle="Play Again"
          playAgainIcon="arrow.clockwise"
        />
      </ScrollView>
    </PhaseTransition>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 32, fontFamily: 'Viral-Black', marginTop: 16 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 18, marginTop: 8, textAlign: 'center' },
  pill: { backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  pillTx: { color: Colors.green, fontSize: 16, fontFamily: 'Viral-Black' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  labelTx: { color: Colors.green, fontSize: 14, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  bubble: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14 },
  bv: { color: '#fff', fontSize: 18, fontFamily: 'Viral-Black' },
  bl: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  hName: { color: '#fff', fontSize: 28, fontFamily: 'Viral-Black' },
  hSub: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statCardInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statVal: { fontSize: 14, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  statLbl: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  progWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  progBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: 6, borderRadius: 3 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'center' },
  tile: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  tileNum: { fontSize: 20, fontFamily: 'Viral-Black' },
  giveUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12, marginHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
  giveUpTx: { color: Colors.red, fontSize: 18, fontWeight: '600' },
  overlayCard: { padding: 32, borderRadius: 24, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  rankFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rankNum: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 'bold' },
  rankName: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black' },
  rankDet: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 },
});
