import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GamePassPhoneView, GameResultsScreen, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ResultsScoreboard } from './ResultsScoreboard';

interface Props { session: GameSession; }
type Phase = 'ready' | 'countdown' | 'playing' | 'playerComplete' | 'results';
interface PathCoord { row: number; col: number; }
type TileState = 'hidden' | 'start' | 'end' | 'correct' | 'wrong';
interface PlayerResult { playerId: string; timeMs: number; attempts: number; finished: boolean; progress: number; }

const GRID_MAP: Record<string, number> = { easy: 5, medium: 6, hard: 7, expert: 8 };
const DEFAULT_GRID = 5;

// Path generator: randomized DFS with self-avoiding path check
function generatePath(rows: number, cols: number, targetLength: number = 8): PathCoord[] {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  const validPaths: PathCoord[][] = [];
  
  function dfs(current: PathCoord, path: PathCoord[], visited: Set<string>): void {
    if (validPaths.length >= 100) return;
    
    if (path.length === targetLength) {
      const s = path[0], e = path[path.length - 1];
      const dist = Math.abs(s.row - e.row) + Math.abs(s.col - e.col);
      // Ensure start and end aren't too close
      if (dist >= 3) {
        validPaths.push([...path]);
      }
      return;
    }
    
    let neighbors: PathCoord[] = [];
    for (const [dr, dc] of dirs) {
      const nr = current.row + dr, nc = current.col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr},${nc}`)) {
        let adjUsed = 0;
        for (const [dr2, dc2] of dirs) {
          const ar = nr + dr2, ac = nc + dc2;
          if (ar >= 0 && ar < rows && ac >= 0 && ac < cols && visited.has(`${ar},${ac}`)) {
            adjUsed++;
          }
        }
        // Self-avoiding path: neighbor should not touch more than 1 visited tile (the current one)
        if (adjUsed <= 1) {
          neighbors.push({ row: nr, col: nc });
        }
      }
    }
    
    // Randomize neighbors
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    
    for (const next of neighbors) {
      const key = `${next.row},${next.col}`;
      visited.add(key);
      path.push(next);
      dfs(next, path, visited);
      path.pop();
      visited.delete(key);
    }
  }
  
  // Try up to 400 random starting positions
  for (let attempt = 0; attempt < 400; attempt++) {
    const startRow = Math.floor(Math.random() * rows);
    const startCol = Math.floor(Math.random() * cols);
    const start: PathCoord = { row: startRow, col: startCol };
    const visited = new Set<string>();
    visited.add(`${start.row},${start.col}`);
    dfs(start, [start], visited);
    if (validPaths.length >= 100) break;
  }
  
  if (validPaths.length > 0) {
    const randIdx = Math.floor(Math.random() * validPaths.length);
    return validPaths[randIdx];
  }
  
  // Fallback: simple random walk if no perfect self-avoiding path is found
  const fallback: PathCoord[] = [];
  let currRow = Math.floor(Math.random() * rows);
  let currCol = Math.floor(Math.random() * cols);
  const visited = new Set<string>();
  
  for (let i = 0; i < targetLength; i++) {
    fallback.push({ row: currRow, col: currCol });
    visited.add(`${currRow},${currCol}`);
    
    const neighbors: PathCoord[] = [];
    for (const [dr, dc] of dirs) {
      const nr = currRow + dr;
      const nc = currCol + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr},${nc}`)) {
        neighbors.push({ row: nr, col: nc });
      }
    }
    if (neighbors.length === 0) break;
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    currRow = next.row;
    currCol = next.col;
  }
  return fallback;
}

export function MemoryPathSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const GRID = GRID_MAP[session.gameConfig?.gridSize] ?? DEFAULT_GRID;
  const pathLength = session.gameConfig?.pathLength ?? 8;
  const gameMode: 'timeRace' | 'turnBased' = session.gameConfig?.gameMode ?? 'timeRace';
  const MAX_ATTEMPTS = 3; // for turn-based mode

  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIndex, setPlayerIndex] = useState(0);
  const [path, setPath] = useState<PathCoord[]>([]);
  const [tileStates, setTileStates] = useState<TileState[][]>([]);
  const [progress, setProgress] = useState(1); // starts at 1 (start tile already known)
  const [attempts, setAttempts] = useState(0);
  const [turnAttempts, setTurnAttempts] = useState(MAX_ATTEMPTS); // for turn-based
  const [wrongTile, setWrongTile] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const shakeAnim = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeAnim.value }] }));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const players = session.players;
  const player = players[playerIndex];
  const stepsToFind = Math.max(0, path.length - 2);
  const stepsFound = Math.max(0, progress - 1);

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => setElapsed(p => +(p + 0.1).toFixed(1)), 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setResults(prev => [...prev, { playerId: player.id, timeMs: 0, attempts: 0, finished: false, progress: 0 }]);
        if (playerIndex + 1 >= players.length) setPhase('results');
        else { setPlayerIndex(i => i + 1); setPhase('ready'); }
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIndex, player, players.length]);

  const initBoard = () => {
    const p = generatePath(GRID, GRID, pathLength);
    setPath(p);
    const states: TileState[][] = Array.from({ length: GRID }, () => Array(GRID).fill('hidden'));
    states[p[0].row][p[0].col] = 'start';
    states[p[p.length - 1].row][p[p.length - 1].col] = 'end';
    setTileStates(states);
    setProgress(1);
    setAttempts(0);
    setTurnAttempts(MAX_ATTEMPTS);
    setElapsed(0);
    setWrongTile(null);
  };

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    initBoard();
    setPhase('countdown');
    setTimeout(() => setPhase('playing'), 1500);
  };

  const resetBoard = (currentPath: PathCoord[], prog: number) => {
    const states: TileState[][] = Array.from({ length: GRID }, () => Array(GRID).fill('hidden'));
    states[currentPath[0].row][currentPath[0].col] = 'start';
    states[currentPath[currentPath.length - 1].row][currentPath[currentPath.length - 1].col] = 'end';
    for (let i = 0; i < prog; i++) {
      const t = currentPath[i];
      if (i === 0) states[t.row][t.col] = 'start';
      else states[t.row][t.col] = 'correct';
    }
    setTileStates(states);
  };

  const triggerShake = () => {
    shakeAnim.value = withSequence(
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const handleTap = (row: number, col: number) => {
    if (phase !== 'playing' || wrongTile || isAnimating) return;
    const expected = path[progress];
    if (!expected) return;

    if (row === expected.row && col === expected.col) {
      // Correct
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newProg = progress + 1;
      setProgress(newProg);
      const newStates = tileStates.map(r => [...r]);
      newStates[row][col] = newProg >= path.length ? 'end' : 'correct';
      setTileStates(newStates);

      if (newProg >= path.length) {
        // Complete!
        if (timerRef.current) clearInterval(timerRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        setIsAnimating(true);
        // Keep path tiles visible (correct state), blink each one-by-one
        const litStates: TileState[][] = Array.from({ length: GRID }, () => Array(GRID).fill('hidden'));
        for (let i = 0; i < path.length; i++) {
          const t = path[i];
          litStates[t.row][t.col] = i === 0 ? 'start' : i === path.length - 1 ? 'end' : 'correct';
        }
        setTileStates(litStates);

        let step = 0;
        const animInterval = setInterval(() => {
          if (step < path.length) {
            setHighlightIndex(step);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            step++;
          } else {
            clearInterval(animInterval);
            setHighlightIndex(null);
            setTimeout(() => {
              setIsAnimating(false);
              setResults(prev => [...prev, { playerId: player.id, timeMs: elapsed * 1000, attempts, finished: true, progress: newProg }]);
              if (playerIndex + 1 >= players.length) setPhase('results');
              else setPhase('playerComplete');
            }, 400);
          }
        }, 120);
      }
    } else {
      // Wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAttempts(prev => prev + 1);
      setWrongTile(`${row},${col}`);
      const newStates = tileStates.map(r => [...r]);
      newStates[row][col] = 'wrong';
      setTileStates(newStates);
      triggerShake();

      if (gameMode === 'turnBased') {
        const remaining = turnAttempts - 1;
        setTurnAttempts(remaining);
        if (remaining <= 0) {
          // Out of attempts — fail this player
          setTimeout(() => {
            setWrongTile(null);
            if (timerRef.current) clearInterval(timerRef.current);
            setResults(prev => [...prev, { playerId: player.id, timeMs: elapsed * 1000, attempts: attempts + 1, finished: false, progress }]);
            if (playerIndex + 1 >= players.length) setPhase('results');
            else setPhase('playerComplete');
          }, 500);
          return;
        }
      }

      setTimeout(() => {
        setWrongTile(null);
        setProgress(1);
        resetBoard(path, 1);
      }, 500);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60), secs = Math.floor(s) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sw = Dimensions.get('window').width;
  const spacing = 6;
  const tileSz = (sw - 24 * 2 - spacing * (GRID - 1)) / GRID;

  const getTileColors = (state: TileState, isWrong: boolean): [string, string] => {
    if (isWrong) return ['rgba(255,59,48,0.5)', 'rgba(255,59,48,0.3)'];
    switch (state) {
      case 'correct': return ['rgba(0,199,190,0.5)', 'rgba(0,199,190,0.25)'];
      case 'start': return ['rgba(52,199,89,0.3)', 'rgba(52,199,89,0.15)'];
      case 'end': return ['rgba(90,200,250,0.3)', 'rgba(90,200,250,0.15)'];
      default: return ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)'];
    }
  };

  const getTileBorder = (state: TileState, isWrong: boolean): string => {
    if (isWrong) return 'rgba(255,59,48,0.7)';
    switch (state) {
      case 'correct': return 'rgba(0,199,190,0.5)';
      case 'start': return 'rgba(52,199,89,0.5)';
      case 'end': return 'rgba(90,200,250,0.5)';
      default: return 'rgba(255,255,255,0.08)';
    }
  };

  if (phase === 'ready') {
    return (
      <GamePassPhoneView
        playerName={player.displayName}
        title={players.length > 1 && playerIndex > 0 ? "Pass the phone to" : "Get ready"}
        subtitle={`Memory Path: Find the hidden path from Start to End!`}
        accentColor="#00C7BE"
        onReady={handleStart}
        onSkip={() => {
          // Record a skipped/DNF result for this player
          setResults(prev => [...prev, { playerId: player.id, timeMs: 0, attempts: 0, finished: false, progress: 0 }]);
          if (playerIndex + 1 >= players.length) setPhase('results');
          else { setPlayerIndex(i => i + 1); setPhase('ready'); }
        }}
      />
    );
  }

  if (phase === 'countdown') {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <IconSymbol name="map.fill" size={56} color="#00C7BE" />
          <Text style={s.title}>Memory Path</Text>
          <Text style={[s.sub, { color: '#00C7BE', fontSize: 22, fontWeight: 'bold' }]}>Get Ready...</Text>
        </View>
      </View>
    );
  }

  if (phase === 'playing') {
    return (
      <View style={s.container}>
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.hName}>{player.displayName}</Text>
            <Text style={s.hSub}>{stepsFound}/{stepsToFind} steps{gameMode === 'turnBased' ? ` · ${turnAttempts} tries left` : ''}</Text>
          </View>
          <View style={s.timerPill}>
            <IconSymbol name="timer" size={16} color="#00C7BE" />
            <Text style={s.timerTx}>{formatTime(elapsed)}</Text>
          </View>
        </View>
        <View style={s.progWrap}>
          <View style={s.progBg}>
            <LinearGradient colors={['#00C7BE','#5AC8FA']} start={{x:0,y:0}} end={{x:1,y:0}}
              style={[s.progFill, { width: stepsToFind > 0 ? `${(stepsFound/stepsToFind)*100}%` as any : '0%' }]} />
          </View>
          <Text style={s.progTx}>Step {stepsFound} of {stepsToFind}</Text>
        </View>
        <Animated.View style={[s.gridWrap, shakeStyle]}>
          {Array.from({ length: GRID }).map((_, r) => (
            <View key={r} style={s.gridRow}>
              {Array.from({ length: GRID }).map((_, c) => {
                const state = tileStates[r]?.[c] || 'hidden';
                const isW = wrongTile === `${r},${c}`;
                let colors = getTileColors(state, isW);
                let border = getTileBorder(state, isW);
                
                const isHighlight = highlightIndex !== null && path[highlightIndex]?.row === r && path[highlightIndex]?.col === c;
                if (isHighlight) {
                  colors = ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.6)'];
                  border = '#fff';
                }

                return (
                  <Pressable key={c} onPress={() => handleTap(r, c)}
                    disabled={state === 'correct' || state === 'start'}
                    style={{ width: tileSz, height: tileSz }}>
                    <LinearGradient colors={colors as [string, string]} start={{x:0,y:0}} end={{x:1,y:1}}
                      style={[s.tile, { borderColor: border }]}>
                      {state === 'start' && <Text style={[s.tileLbl, { color: Colors.green }]}>Start</Text>}
                      {state === 'end' && <Text style={[s.tileLbl, { color: '#5AC8FA' }]}>End</Text>}
                      {state === 'correct' && <IconSymbol name="checkmark" size={16} color="rgba(255,255,255,0.6)" />}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>

      </View>
    );
  }

  if (phase === 'playerComplete') {
    return (
      <GamePlayerCompleteView
        nextPlayerName={players[playerIndex + 1]?.displayName || 'Next Player'}
        prevResultLine={`${player.displayName} — ${formatTime(elapsed)}`}
        onReady={() => { setPlayerIndex(i => i+1); handleStart(); }}
        accentColor="#00C7BE"
      />
    );
  }

  // Results
  const sorted = [...results].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    return a.timeMs - b.timeMs;
  });

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={sorted.map(r => {
            const p = players.find(x => x.id === r.playerId);
            return {
              id: r.playerId,
              name: p?.displayName ?? 'Player',
              primary: r.finished ? `${(r.timeMs / 1000).toFixed(1)}s` : 'DNF',
              secondary: r.finished ? `${r.attempts} tries` : `${r.progress} steps completed`,
            };
          })}
          title={players.length > 1 ? 'Final Rankings' : 'Complete!'}
          subtitle={players.length > 1 ? undefined : 'Great memory!'}
          shareGameName="Memory Path"
          onPlayAgain={() => {
            setPlayerIndex(0);
            setResults([]);
            setPhase('ready');
          }}
          playAgainTitle="Play Again"
          playAgainIcon="arrow.clockwise"
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconBox: { width: 100, height: 100, borderRadius: 28, backgroundColor: 'rgba(0,199,190,0.14)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black', marginTop: 16 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 8 },
  pill: { backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  pillTx: { color: Colors.green, fontSize: 12, fontFamily: 'Viral-Black' },
  bubbleRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  bubble: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14 },
  bv: { color: '#fff', fontSize: 15, fontFamily: 'Viral-Black' },
  bl: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  hName: { color: '#fff', fontSize: 17, fontFamily: 'Viral-Black' },
  hSub: { color: '#00C7BE', fontSize: 12, fontWeight: '600', marginTop: 2 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  timerTx: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  progWrap: { paddingHorizontal: 16, marginBottom: 12 },
  progBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: 8, borderRadius: 4 },
  progTx: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 4 },
  gridWrap: { alignSelf: 'center', gap: 6, paddingHorizontal: 24 },
  gridRow: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2 },
  tileLbl: { fontSize: 10, fontFamily: 'Viral-Black' },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  rankFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rankNum: { color: 'rgba(255,255,255,0.5)', fontSize: 17, fontWeight: 'bold' },
  rankName: { color: '#fff', fontSize: 15, fontFamily: 'Viral-Black' },
  rankDet: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
});
