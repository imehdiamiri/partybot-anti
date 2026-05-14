import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props { session: GameSession; }
type Phase = 'ready' | 'playing' | 'playerComplete' | 'results';

// Matches iOS ColorTrapViewModel.palette
const PALETTE = [Colors.red, '#007AFF', Colors.green, Colors.yellow, '#AF52DE'];
const PALETTE_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
const MAX_FAILS = 3;
const COLUMNS = 4;

interface Spawn { id: number; appearAt: number; columnIndex: number; colorIndex: number; size: number; }
interface ActiveTile { id: number; spawnedAt: number; columnIndex: number; colorIndex: number; size: number; isHit: boolean; }
interface PlayerResult { playerId: string; hits: number; fails: number; survivalTime: number; score: number; eliminated: boolean; }

// Difficulty: matches iOS ColorTrapDifficulty
const DIFFICULTIES = {
  easy: { spawnInterval: 0.9, tileLifetime: 1.9, totalDuration: 20, label: 'Easy' },
  medium: { spawnInterval: 0.65, tileLifetime: 1.5, totalDuration: 30, label: 'Medium' },
  hard: { spawnInterval: 0.45, tileLifetime: 1.15, totalDuration: 45, label: 'Hard' },
};

type Difficulty = keyof typeof DIFFICULTIES;

// Pre-generate spawn schedule (like iOS ColorTrapGenerator)
function generateSpawns(diff: typeof DIFFICULTIES.medium, seed: number): Spawn[] {
  const spawns: Spawn[] = [];
  let t = 0.5; let id = 0;
  const rng = seedRng(seed);
  while (t < diff.totalDuration) {
    spawns.push({
      id: id++,
      appearAt: t,
      columnIndex: Math.floor(rng() * COLUMNS),
      colorIndex: Math.floor(rng() * 5),
      size: 0.8 + rng() * 0.4,
    });
    t += diff.spawnInterval * (0.7 + rng() * 0.6);
  }
  return spawns;
}

function seedRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

export function ColorTrapSession({ session }: Props) {
  const players = session.players;
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const d = session.gameConfig?.difficulty;
    if (d === 'easy' || d === 'medium' || d === 'hard') return d;
    return 'medium';
  });
  const [results, setResults] = useState<PlayerResult[]>([]);

  // Game state
  const [forbiddenIdx, setForbiddenIdx] = useState(0);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const [activeTiles, setActiveTiles] = useState<ActiveTile[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [eliminated, setEliminated] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnCursorRef = useRef(0);
  const elapsedRef = useRef(0);
  const activeTilesRef = useRef<ActiveTile[]>([]);
  const hitsRef = useRef(0);
  const failsRef = useRef(0);
  const gameActiveRef = useRef(false);

  const diff = DIFFICULTIES[difficulty];
  const player = players[playerIdx];
  const failsLeft = Math.max(0, MAX_FAILS - fails);

  const sw = Dimensions.get('window').width;
  const colWidth = (sw - 48) / COLUMNS;
  const tileSize = Math.min(colWidth * 0.78, 72);

  const startGame = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seed = Date.now();
    const forbidden = Math.floor(Math.random() * 5);
    const sp = generateSpawns(diff, seed);
    setForbiddenIdx(forbidden);
    setSpawns(sp);
    setActiveTiles([]);
    setElapsed(0);
    setHits(0);
    hitsRef.current = 0;
    setFails(0);
    setEliminated(false);
    spawnCursorRef.current = 0;
    elapsedRef.current = 0;
    activeTilesRef.current = [];
    failsRef.current = 0;
    gameActiveRef.current = true;

    // Tick loop: 50ms like iOS
    tickRef.current = setInterval(() => {
      if (!gameActiveRef.current) return;
      const step = 0.05;
      elapsedRef.current += step;
      setElapsed(elapsedRef.current);

      // Spawn tiles
      while (spawnCursorRef.current < sp.length && sp[spawnCursorRef.current].appearAt <= elapsedRef.current) {
        const s = sp[spawnCursorRef.current];
        activeTilesRef.current.push({ ...s, spawnedAt: elapsedRef.current, isHit: false });
        spawnCursorRef.current++;
      }

      // Expire tiles
      const lt = diff.tileLifetime;
      const expiring = activeTilesRef.current.filter(tile =>
        !tile.isHit && (elapsedRef.current - tile.spawnedAt) > lt
      );
      // Non-forbidden tiles that expire without tap = missed fail
      for (const tile of expiring) {
        if (tile.colorIndex !== forbidden) {
          failsRef.current++;
          setFails(failsRef.current);
          if (failsRef.current >= MAX_FAILS) {
            setEliminated(true);
            finishGame(true);
            return;
          }
        }
      }
      activeTilesRef.current = activeTilesRef.current.filter(tile => {
        if (!tile.isHit && (elapsedRef.current - tile.spawnedAt) > lt) return false;
        if (tile.isHit && (elapsedRef.current - tile.spawnedAt) > 0.35) return false;
        return true;
      });

      setActiveTiles([...activeTilesRef.current]);

      // Check duration
      if (elapsedRef.current >= diff.totalDuration) {
        finishGame(false);
      }
    }, 50);

    setPhase('playing');
  };

  const finishGame = useCallback((wasEliminated: boolean) => {
    gameActiveRef.current = false;
    if (tickRef.current) clearInterval(tickRef.current);
    const score = hitsRef.current * 10 + Math.floor(elapsedRef.current * 5) - failsRef.current * 15;
    setResults(prev => [...prev, {
      playerId: player.id, hits: hitsRef.current, fails: failsRef.current,
      survivalTime: elapsedRef.current, score: Math.max(0, score), eliminated: wasEliminated,
    }]);
    if (playerIdx + 1 >= players.length) setPhase('results');
    else setPhase('playerComplete');
  }, [player, playerIdx, players.length]);

  const handleTap = (tileId: number) => {
    if (!gameActiveRef.current) return;
    const idx = activeTilesRef.current.findIndex(t => t.id === tileId && !t.isHit);
    if (idx < 0) return;
    const tile = activeTilesRef.current[idx];

    if (tile.colorIndex === forbiddenIdx) {
      // Wrong! Tapped forbidden
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      failsRef.current++;
      setFails(failsRef.current);
      if (failsRef.current >= MAX_FAILS) {
        setEliminated(true);
        finishGame(true);
      }
    } else {
      // Correct
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      activeTilesRef.current[idx].isHit = true;
      hitsRef.current++;
      setHits(hitsRef.current);
    }
  };

  useEffect(() => {
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // ═══ READY ═══
  if (phase === 'ready') {
    return (
      <View style={st.container}><View style={st.center}>
        <View style={[st.iconBox, { backgroundColor: 'rgba(255,59,48,0.14)' }]}>
          <IconSymbol name="paintpalette.fill" size={52} color={Colors.red} />
        </View>
        <Text style={st.title}>Color Trap</Text>
        <Text style={st.sub}>Tap every tile EXCEPT the forbidden color!</Text>
        {players.length > 1 && <View style={st.pill}><Text style={st.pillTx}>Now · {player.displayName}</Text></View>}

        {/* Difficulty picker */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => {
            const sel = difficulty === d;
            const col = d === 'easy' ? Colors.green : d === 'medium' ? Colors.orange : Colors.red;
            return (
              <Pressable key={d} onPress={() => setDifficulty(d)}
                style={[st.diffChip, sel && { borderColor: col + '80', backgroundColor: col + '33' }]}>
                <Text style={[st.diffTx, sel && { color: '#fff' }]}>{DIFFICULTIES[d].label}</Text>
                <Text style={[st.diffSub, sel && { color: 'rgba(255,255,255,0.7)' }]}>{DIFFICULTIES[d].totalDuration}s</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={st.btn} onPress={startGame}><Text style={st.btnTx}>Start</Text></Pressable>
      </View></View>
    );
  }

  // ═══ PLAYING ═══
  if (phase === 'playing') {
    const timeLeft = Math.max(0, diff.totalDuration - elapsed);
    return (
      <View style={st.container}>
        {/* Header: forbidden color + hearts */}
        <View style={st.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={st.headerTx}>Don&apos;t tap</Text>
            <View style={[st.forbiddenDot, { backgroundColor: PALETTE[forbiddenIdx] }]} />
            <Text style={[st.headerTx, { color: PALETTE[forbiddenIdx], fontWeight: 'bold' }]}>{PALETTE_NAMES[forbiddenIdx]}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <IconSymbol key={i} name="heart.fill" size={20} color={i < failsLeft ? Colors.red : 'rgba(255,255,255,0.15)'} />
            ))}
          </View>
        </View>

        {/* Timer bar */}
        <View style={st.timerBar}>
          <View style={[st.timerFill, { width: `${(timeLeft / diff.totalDuration) * 100}%` as any }]} />
        </View>

        {/* Stats */}
        <View style={st.statsRow}>
          <Text style={st.statTx}>{hits} hits</Text>
          <Text style={st.statTx}>{Math.ceil(timeLeft)}s</Text>
        </View>

        {/* Arena */}
        <View style={[st.arena, { height: sw * 1.1 }]}>
          {activeTiles.map(tile => {
            const progress = Math.min(1, (elapsed - tile.spawnedAt) / diff.tileLifetime);
            const y = progress * (sw * 1.1 - tileSize);
            const x = 24 + tile.columnIndex * colWidth + (colWidth - tileSize * tile.size) / 2;
            const isForbidden = tile.colorIndex === forbiddenIdx;
            return (
              <Pressable
                key={tile.id}
                onPress={() => handleTap(tile.id)}
                style={[st.fallingTile, {
                  left: x, top: y,
                  width: tileSize * tile.size, height: tileSize * tile.size,
                  backgroundColor: PALETTE[tile.colorIndex],
                  opacity: tile.isHit ? 0.2 : 1,
                  transform: [{ scale: tile.isHit ? 0.5 : 1 }],
                }]}
              />
            );
          })}
        </View>
      </View>
    );
  }

  // ═══ PLAYER COMPLETE ═══
  if (phase === 'playerComplete') {
    const last = results[results.length - 1];
    return (
      <View style={st.container}><View style={st.center}>
        <IconSymbol name={last?.eliminated ? 'xmark.circle.fill' : 'checkmark.circle.fill'} size={56}
          color={last?.eliminated ? Colors.red : Colors.green} />
        <Text style={st.title}>{last?.eliminated ? 'Eliminated!' : 'Time\'s Up!'}</Text>
        <Text style={st.sub}>{player.displayName} — Score: {last?.score}</Text>
        <Pressable style={[st.btn, { marginTop: 40 }]} onPress={() => { setPlayerIdx(i => i+1); setPhase('ready'); }}>
          <Text style={st.btnTx}>Next Player</Text>
        </Pressable>
      </View></View>
    );
  }

  // ═══ RESULTS ═══
  const sorted = [...results].sort((a, b) => b.score - a.score);
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
                <Text style={st.rankDet}>{r.hits} hits · {r.fails} fails · {r.survivalTime.toFixed(1)}s{r.eliminated ? ' · Eliminated' : ''}</Text>
              </View>
              <Text style={{ color: Colors.orange, fontSize: 17, fontWeight: 'bold' }}>{r.score}</Text>
            </View>
          );
        })}
        <Pressable style={[st.btn, { backgroundColor: Colors.green }]} onPress={() => { setPlayerIdx(0); setResults([]); setPhase('ready'); }}>
          <Text style={st.btnTx}>Play Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 8, textAlign: 'center' },
  pill: { backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  pillTx: { color: Colors.green, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  diffChip: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  diffTx: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 'bold' },
  diffSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  headerTx: { color: '#fff', fontSize: 15, fontWeight: '600' },
  forbiddenDot: { width: 18, height: 18, borderRadius: 9 },
  timerBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  timerFill: { height: 4, backgroundColor: '#5AC8FA', borderRadius: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  statTx: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  arena: { backgroundColor: 'rgba(0,0,0,0.15)', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  fallingTile: { position: 'absolute', borderRadius: 14 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  rankFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rankNum: { color: 'rgba(255,255,255,0.5)', fontSize: 17, fontWeight: 'bold' },
  rankName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rankDet: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
});
