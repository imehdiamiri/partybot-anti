import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  session: GameSession;
}

type Phase = 'ready' | 'playing' | 'playerComplete' | 'results';

// Matches iOS MemoryGridViewModel.tileSymbols exactly
const TILE_SYMBOLS: string[] = [
  'star.fill', 'heart.fill', 'moon.fill', 'sun.max.fill',
  'bolt.fill', 'flame.fill', 'leaf.fill', 'drop.fill',
  'snowflake', 'cloud.fill', 'wind', 'tornado',
  'sparkles', 'bell.fill', 'flag.fill', 'crown.fill',
  'diamond.fill', 'globe.americas.fill'
];

// Matches iOS MemoryTileView.tileColors exactly
const TILE_COLORS = [
  '#5AC8FA', '#FF2D55', Colors.orange, Colors.green, '#AF52DE',
  Colors.yellow, '#00C7BE', Colors.red, '#5856D6', '#30B0C7'
];

interface MemoryTile {
  id: string;
  pairId: number;
  symbol: string;
  colorIndex: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface PlayerTime {
  playerId: string;
  elapsedSeconds: number;
  moveCount: number;
}

const GRID_SIZES: Record<string, {cols:number;rows:number}> = {
  tiny3x4: {cols:3,rows:4}, small4x4: {cols:4,rows:4},
  medium4x5: {cols:4,rows:5}, large5x6: {cols:5,rows:6}, huge6x6: {cols:6,rows:6},
};

function getGridDims(session: {gameConfig?: Record<string,any>}) {
  const key = session.gameConfig?.gridSize || 'tiny3x4';
  return GRID_SIZES[key] || GRID_SIZES.tiny3x4;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

import { useGameSync } from '@/src/hooks/useGameSync';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';

// Animated tile wrapper with 3D flip effect matching iOS rotation3DEffect
function FlipTile({ isFlipped, isMatched, color, symbol, size, onPress, disabled, index }: {
  isFlipped: boolean; isMatched: boolean; color: string; symbol: string;
  size: number; onPress: () => void; disabled: boolean; index: number;
}) {
  const flipAnim = useSharedValue(0);
  const isShowingFront = isFlipped || isMatched;

  React.useEffect(() => {
    flipAnim.value = withSpring(isShowingFront ? 1 : 0, { damping: 12, stiffness: 130 });
  }, [isShowingFront]);

  const frontStyle = useAnimatedStyle(() => {
    const deg = interpolate(flipAnim.value, [0, 0.5, 1], [180, 90, 0], Extrapolation.CLAMP);
    const op = flipAnim.value >= 0.5 ? 1 : 0;
    return { transform: [{ rotateY: `${deg}deg` }], opacity: op };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = interpolate(flipAnim.value, [0, 0.5, 1], [0, 90, 180], Extrapolation.CLAMP);
    const op = flipAnim.value < 0.5 ? 1 : 0;
    return { transform: [{ rotateY: `${deg}deg` }], opacity: op };
  });

  return (
    <Pressable
      style={[
        styles.tileWrapper,
        { width: size, height: size },
        isMatched && { opacity: 0.55, transform: [{ scale: 0.94 }] },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityLabel={isShowingFront ? `Tile ${symbol}` : `Hidden tile ${index + 1}`}
      accessibilityHint={isMatched ? 'Already matched' : isFlipped ? 'Flipped' : 'Double-tap to flip'}
      accessibilityRole="button"
    >
      {/* Front face */}
      <Animated.View style={[StyleSheet.absoluteFill, { backfaceVisibility: 'hidden' }, frontStyle]}>
        <LinearGradient
          colors={[
            color + (isMatched ? '59' : 'A6'),
            color + (isMatched ? '33' : '59'),
          ]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.tileFront, {
            borderColor: color + (isMatched ? '73' : 'E6'),
            shadowColor: color,
          }]}
        >
          <IconSymbol name={symbol as any} size={28} color="white" />
        </LinearGradient>
      </Animated.View>
      {/* Back face */}
      <Animated.View style={[StyleSheet.absoluteFill, { backfaceVisibility: 'hidden' }, backStyle]}>
        <LinearGradient
          colors={['#38408C', '#1E2359']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.tileBack}
        >
          <IconSymbol name="questionmark" size={24} color="rgba(90,200,250,0.75)" />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function MemoryGridSession({ session }: Props) {
  const [boardState, setBoardState] = useState({
    phase: 'ready' as Phase,
    currentPlayerIndex: 0,
    tiles: [] as MemoryTile[],
    firstFlippedIndex: null as number | null,
    isResolving: false,
    matchedPairs: 0,
    moveCount: 0
  });

  const { phase, currentPlayerIndex, tiles, firstFlippedIndex, isResolving, matchedPairs, moveCount } = boardState;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [playerTimes, setPlayerTimes] = useState<PlayerTime[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const players = session.players;
  const currentPlayer = players[currentPlayerIndex];

  // Timer: increments by 0.1 every 100ms, exactly like iOS
  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => +(prev + 0.1).toFixed(1));
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds) % 60;
    const tenths = Math.floor((seconds * 10) % 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${secs}.${tenths}`;
  };

  // Generates board exactly like iOS: shuffled symbols, each with colorIndex
  const { cols, rows } = getGridDims(session);
  const PAIR_COUNT = Math.floor((cols * rows) / 2);

  const generateBoard = useCallback((): MemoryTile[] => {
    const symbols = shuffleArray(TILE_SYMBOLS).slice(0, PAIR_COUNT);
    let board: MemoryTile[] = [];
    for (let pairId = 0; pairId < symbols.length; pairId++) {
      const colorIdx = pairId % 10;
      board.push({
        id: `a_${pairId}`,
        pairId,
        symbol: symbols[pairId],
        colorIndex: colorIdx,
        isFlipped: false,
        isMatched: false,
      });
      board.push({
        id: `b_${pairId}`,
        pairId,
        symbol: symbols[pairId],
        colorIndex: colorIdx,
        isFlipped: false,
        isMatched: false,
      });
    }
    return shuffleArray(board);
  }, []);

  const { syncState, sendAction, isHost } = useGameSync(
    session.mode,
    boardState,
    setBoardState,
    (type, data) => {
      if (type === 'flip') {
        processTileFlip(data.index);
      } else if (type === 'start') {
        handleStart(true);
      }
    }
  );

  const handleStart = (fromSync = false) => {
    if (!isHost && !fromSync) return; // Only host can start
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const board = generateBoard();
    
    syncState({
      phase: 'playing',
      currentPlayerIndex: boardState.currentPlayerIndex,
      tiles: board,
      firstFlippedIndex: null,
      isResolving: false,
      matchedPairs: 0,
      moveCount: 0
    });
    
    setElapsedSeconds(0);
  };

  const handleFlipTile = (index: number) => {
    if (!tiles[index] || isResolving) return;
    if (tiles[index].isFlipped || tiles[index].isMatched) return;

    if (!isHost) {
      // Send the flip action to the host instead of processing it locally
      sendAction('flip', { index });
      return;
    }

    processTileFlip(index);
  };

  const processTileFlip = (index: number) => {
    if (!tiles[index] || isResolving) return;
    if (tiles[index].isFlipped || tiles[index].isMatched) return;

    Haptics.selectionAsync();

    const newTiles = [...tiles];
    newTiles[index] = { ...newTiles[index], isFlipped: true };
    
    syncState({ ...boardState, tiles: newTiles });

    if (firstFlippedIndex !== null) {
      const newMoveCount = moveCount + 1;
      
      if (newTiles[firstFlippedIndex].pairId === newTiles[index].pairId) {
        // Match!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const matched = [...newTiles];
        matched[firstFlippedIndex] = { ...matched[firstFlippedIndex], isMatched: true };
        matched[index] = { ...matched[index], isMatched: true };
        
        const newMatchedPairs = matchedPairs + 1;
        syncState({ 
          ...boardState, 
          tiles: matched, 
          matchedPairs: newMatchedPairs, 
          moveCount: newMoveCount,
          firstFlippedIndex: null 
        });

        if (newMatchedPairs >= PAIR_COUNT) {
          handlePlayerComplete();
        }
      } else {
        // Mismatch
        const capturedFirst = firstFlippedIndex;
        const capturedSecond = index;
        
        syncState({
          ...boardState,
          tiles: newTiles,
          moveCount: newMoveCount,
          isResolving: true,
          firstFlippedIndex: null
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setBoardState(prev => {
            const t = [...prev.tiles];
            t[capturedFirst] = { ...t[capturedFirst], isFlipped: false };
            t[capturedSecond] = { ...t[capturedSecond], isFlipped: false };
            const nextState = { ...prev, tiles: t, isResolving: false };
            if (isHost) syncState(nextState);
            return nextState;
          });
        }, 800);
      }
    } else {
      syncState({ ...boardState, tiles: newTiles, firstFlippedIndex: index });
    }
  };

  const handlePlayerComplete = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setPlayerTimes(prev => [...prev, {
      playerId: currentPlayer.id,
      elapsedSeconds,
      moveCount,
    }]);

    const nextIndex = currentPlayerIndex + 1;
    if (nextIndex >= players.length) {
      if (isHost) syncState({ ...boardState, phase: 'results' });
    } else {
      if (isHost) syncState({ ...boardState, phase: 'playerComplete' });
    }
  };

  const handleNextPlayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isHost) syncState({ ...boardState, currentPlayerIndex: currentPlayerIndex + 1, phase: 'ready' });
  };

  const handlePlayAgain = () => {
    setPlayerTimes([]);
    if (isHost) syncState({ ...boardState, currentPlayerIndex: 0, phase: 'ready' });
  };

  const tileColor = (colorIndex: number) => TILE_COLORS[colorIndex % TILE_COLORS.length];

  const progress = PAIR_COUNT > 0 ? matchedPairs / PAIR_COUNT : 0;

  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 24;
  const tileGap = 8;
  const availableWidth = screenWidth - gridPadding * 2;
  const tileSize = (availableWidth - tileGap * (cols - 1)) / cols;

  // ──────────── READY VIEW ────────────
  if (phase === 'ready') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <View style={styles.iconContainer}>
            <IconSymbol name="square.grid.3x3.fill" size={52} color="#5AC8FA" />
          </View>

          {players.length > 1 ? (
            <View style={styles.readyTextGroup}>
              <View style={styles.turnPill}>
                <Text style={styles.turnPillText}>Now · {players[boardState.currentPlayerIndex]?.displayName}</Text>
              </View>
              <Text style={styles.readySubtitle}>Your turn! Get ready to memorize.</Text>
            </View>
          ) : (
            <View style={styles.readyTextGroup}>
              <Text style={styles.readyTitle}>Memory Grid</Text>
              <Text style={styles.readySubtitle}>Find all matching pairs!</Text>
            </View>
          )}

          <View style={styles.statBubbleRow}>
            <View style={styles.statBubble}>
              <Text style={styles.statBubbleValue}>{cols}×{rows}</Text>
              <Text style={styles.statBubbleLabel}>Grid</Text>
            </View>
            <View style={styles.statBubble}>
              <Text style={styles.statBubbleValue}>{PAIR_COUNT}</Text>
              <Text style={styles.statBubbleLabel}>Pairs</Text>
            </View>
            {players.length > 1 && (
              <View style={styles.statBubble}>
                <Text style={styles.statBubbleValue}>{currentPlayerIndex + 1}/{players.length}</Text>
                <Text style={styles.statBubbleLabel}>Player</Text>
              </View>
            )}
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => handleStart()}>
            <Text style={styles.primaryBtnText}>Start</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ──────────── PLAYING VIEW ────────────
  if (phase === 'playing') {
    return (
      <View style={styles.container}>
        {/* Header: matches iOS gameHeader */}
        <View style={styles.gameHeader}>
          <View style={{ flex: 1 }}>
            {players.length > 1 ? (
              <View style={styles.turnPill}>
                <Text style={styles.turnPillText}>Now · {currentPlayer.displayName}</Text>
              </View>
            ) : (
              <Text style={styles.headerTitle}>Memory Grid</Text>
            )}
            <Text style={styles.headerSubtitle}>{matchedPairs}/{PAIR_COUNT} pairs</Text>
          </View>

          <View style={styles.statsGroup}>
            <View style={[styles.statPill, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
              <IconSymbol name="hand.tap.fill" size={12} color={Colors.orange} />
              <Text style={[styles.statPillText, { color: Colors.orange }]}>{moveCount}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: 'rgba(90,200,250,0.1)' }]}>
              <IconSymbol name="timer" size={12} color="#5AC8FA" />
              <Text style={[styles.statPillText, { color: '#5AC8FA' }]}>{formatTime(elapsedSeconds)}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar: matches iOS */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#5AC8FA', '#007AFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${Math.max(progress * 100, 1)}%` as any }]}
            />
          </View>
        </View>

        {/* Grid: matches iOS gridBoard */}
        <View style={[styles.gridContainer, { paddingHorizontal: gridPadding - 12 }]}>
          <View style={[styles.grid, { gap: tileGap }]}>
            {tiles.map((tile, i) => {
              const color = tileColor(tile.colorIndex);
              return (
                <FlipTile
                  key={tile.id}
                  isFlipped={tile.isFlipped}
                  isMatched={tile.isMatched}
                  color={color}
                  symbol={tile.symbol}
                  size={tileSize}
                  onPress={() => handleFlipTile(i)}
                  disabled={tile.isFlipped || tile.isMatched || isResolving}
                  index={i}
                />
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // ──────────── PLAYER COMPLETE VIEW ────────────
  if (phase === 'playerComplete') {
    const lastResult = playerTimes[playerTimes.length - 1];
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <IconSymbol name="checkmark.circle.fill" size={56} color={Colors.green} />
          <Text style={[styles.readyTitle, { marginTop: 16 }]}>
            {players[currentPlayerIndex]?.displayName} Finished!
          </Text>
          <Text style={styles.readySubtitle}>
            {lastResult ? `${formatTime(lastResult.elapsedSeconds)} · ${lastResult.moveCount} moves` : ''}
          </Text>

          <Pressable style={[styles.primaryBtn, { marginTop: 40 }]} onPress={handleNextPlayer}>
            <Text style={styles.primaryBtnText}>
              {currentPlayerIndex + 1 < players.length ? "Next Player" : "See Results"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ──────────── RESULTS VIEW ────────────
  const sorted = [...players].sort((a, b) => {
    const aTime = playerTimes.find(t => t.playerId === a.id)?.elapsedSeconds ?? 999;
    const bTime = playerTimes.find(t => t.playerId === b.id)?.elapsedSeconds ?? 999;
    return aTime - bTime;
  });

  const entries: RankEntry[] = sorted.map((player) => {
    const result = playerTimes.find(t => t.playerId === player.id);
    return {
      id: player.id,
      name: player.displayName,
      primary: result ? formatTime(result.elapsedSeconds) : '—',
      secondary: result ? `${result.moveCount} moves` : undefined,
    };
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.resultsContent}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Complete!'}
        />

        <Pressable style={styles.primaryBtn} onPress={handlePlayAgain}>
          <Text style={styles.primaryBtnText}>Play Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultsContent: { padding: 16, paddingBottom: 40 },

  // Ready view
  iconContainer: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: 'rgba(90,200,250,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  readyTextGroup: { alignItems: 'center', marginTop: 20, gap: 8 },
  readyTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  readySubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },

  turnPill: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },
  turnPillText: { color: Colors.green, fontSize: 13, fontWeight: '700' },

  statBubbleRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  statBubble: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, minWidth: 60,
  },
  statBubbleValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  statBubbleLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },

  primaryBtn: {
    backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16,
    width: '100%', alignItems: 'center', marginTop: 32,
  },
  primaryBtnText: { color: 'white', fontSize: 17, fontWeight: 'bold' },

  // Game header
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  statsGroup: { flexDirection: 'row', gap: 10 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  statPillText: { fontSize: 13, fontWeight: 'bold', fontVariant: ['tabular-nums'] },

  // Progress bar
  progressBarContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },

  // Grid
  gridContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tileWrapper: { },
  tileFront: {
    flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  tileBack: {
    flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(90,200,250,0.4)',
  },

});
