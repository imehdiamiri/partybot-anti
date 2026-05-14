import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Preview countdown
  useEffect(() => {
    if (phase === 'preview' && previewLeft > 0) {
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
      timerRef.current = setInterval(() => setElapsed(p => +(p + 0.1).toFixed(1)), 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

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
      <View style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,149,0,0.14)' }]}>
            <IconSymbol name="brain.head.profile" size={52} color={Colors.orange} />
          </View>
          <Text style={st.title}>Tap in Order</Text>
          <Text style={st.sub}>Memorize the numbers, then tap 1→{TILE_COUNT}</Text>
          {players.length > 1 && <View style={st.pill}><Text style={st.pillTx}>Now · {player.displayName}</Text></View>}
          <View style={st.label}><IconSymbol name="checkmark.seal.fill" size={12} color={Colors.green} /><Text style={st.labelTx}>Fewest mistakes wins</Text></View>
          <View style={st.bubbleRow}>
            <View style={st.bubble}><Text style={st.bv}>{GRID_SIZE}×{GRID_SIZE}</Text><Text style={st.bl}>Grid</Text></View>
            <View style={st.bubble}><Text style={st.bv}>{TILE_COUNT}</Text><Text style={st.bl}>Tiles</Text></View>
            {players.length > 1 && <View style={st.bubble}><Text style={st.bv}>{playerIndex+1}/{players.length}</Text><Text style={st.bl}>Player</Text></View>}
          </View>
          <Pressable style={st.btn} onPress={handleStart}><Text style={st.btnTx}>Start</Text></Pressable>
        </View>
      </View>
    );
  }

  // ──── OUTCOME OVERLAY ────
  if (phase === 'outcome') {
    const accent = gaveUp ? Colors.orange : Colors.green;
    const icon = gaveUp ? 'flag.fill' : 'checkmark.seal.fill';
    const label = gaveUp ? 'Gave Up' : 'Done!';
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[st.overlayCard, { borderColor: accent + '4D' }]}>
          <IconSymbol name={icon as any} size={72} color={accent} />
          <Text style={[st.title, { color: accent }]}>{label}</Text>
          <Text style={st.sub}>{missTaps} mistakes · {formatTime(elapsed)}s</Text>
          {players.length > 1 && <Text style={[st.sub, { marginTop: 8 }]}>Pass the phone to the next player</Text>}
        </View>
      </View>
    );
  }

  // ──── PLAYER COMPLETE (pass phone) ────
  if (phase === 'playerComplete') {
    return (
      <View style={st.container}>
        <View style={st.center}>
          <IconSymbol name="hand.raised.fill" size={56} color={Colors.orange} />
          <Text style={st.title}>Pass the Phone</Text>
          <Text style={st.sub}>Give to {players[playerIndex + 1]?.displayName}</Text>
          <Pressable style={[st.btn, { marginTop: 40 }]} onPress={() => { setPlayerIndex(i => i+1); setPhase('ready'); }}>
            <Text style={st.btnTx}>I&apos;m Ready</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ──── PREVIEW / PLAYING ────
  if (phase === 'preview' || phase === 'playing') {
    const isPreview = phase === 'preview';
    const previewProgress = isPreview ? 1.0 - (previewLeft / previewTotal) : progressVal;

    return (
      <View style={st.container}>
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
            <LinearGradient colors={[Colors.orange,'#FF2D55']} start={{x:0,y:0}} end={{x:1,y:0}}
              style={[st.progFill, { width: `${Math.max(previewProgress * 100, 1)}%` as any }]} />
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
      </View>
    );
  }

  // ──── RESULTS ────
  const sorted = [...results].sort((a, b) => {
    if (a.missTaps !== b.missTaps) return a.missTaps - b.missTaps;
    return a.timeMs - b.timeMs;
  });

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', gap: 8, marginVertical: 20 }}>
          <IconSymbol name="trophy.fill" size={44} color={Colors.yellow} />
          <Text style={st.title}>{players.length > 1 ? 'Final Rankings' : 'Complete!'}</Text>
        </View>
        {sorted.map((r, i) => {
          const p = players.find(x => x.id === r.playerId);
          return (
            <View key={r.playerId} style={[st.rankRow, i === 0 && st.rankFirst]}>
              <View style={[st.rankCircle, i === 0 && { backgroundColor: 'rgba(255,204,0,0.2)' }]}>
                <Text style={[st.rankNum, i === 0 && { color: Colors.yellow }]}>{i+1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.rankName}>{p?.displayName}</Text>
                <Text style={st.rankDet}>{r.correctCount}/{r.totalTargets} correct · {r.missTaps} miss · {(r.timeMs/1000).toFixed(1)}s</Text>
              </View>
              {i === 0 && r.didFinish && <IconSymbol name="crown.fill" size={16} color={Colors.yellow} />}
            </View>
          );
        })}
        <Pressable style={[st.btn, { marginTop: 24 }]} onPress={() => { setPlayerIndex(0); setResults([]); setPhase('ready'); }}>
          <Text style={st.btnTx}>Play Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 16 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 8, textAlign: 'center' },
  pill: { backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  pillTx: { color: Colors.green, fontSize: 13, fontWeight: '700' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  labelTx: { color: Colors.green, fontSize: 12, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  bubble: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14 },
  bv: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bl: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  hName: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  hSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statCardInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statVal: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLbl: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  progWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  progBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: 6, borderRadius: 3 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'center' },
  tile: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  tileNum: { fontSize: 22, fontWeight: '800' },
  giveUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12, marginHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
  giveUpTx: { color: Colors.red, fontSize: 15, fontWeight: '600' },
  overlayCard: { padding: 32, borderRadius: 24, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  rankFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rankNum: { color: 'rgba(255,255,255,0.5)', fontSize: 17, fontWeight: 'bold' },
  rankName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rankDet: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
});
