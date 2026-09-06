import { SecondaryPlayerLabel, useGameActivity, GAME_UI } from './GameActivity';
import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { GameMode } from '@/src/models/AppModels';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import {
  generateDeterministicMemoryGridBoard,
  rankMemoryGridResults,
  getAuthoritativeGridDims,
  DeterministicMemoryTile,
} from '@/src/models/CompetitiveRound';
import { useCompetitiveRound } from '@/src/hooks/useCompetitiveRound';
import { getServerNow } from '@/src/services/ServerClock';

interface Props {
  session: GameSession;
}

type SingleDevicePhase = 'ready' | 'playing' | 'playerComplete' | 'results';

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

interface SingleDeviceTile {
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
  isSkipped?: boolean;
}

const GRID_SIZES: Record<string, { cols: number; rows: number }> = {
  tiny3x4: { cols: 3, rows: 4 }, small4x4: { cols: 4, rows: 4 },
  medium4x5: { cols: 4, rows: 5 }, large5x6: { cols: 5, rows: 6 }, huge6x6: { cols: 6, rows: 6 },
};

function getGridDims(session: { gameConfig?: Record<string, any> }) {
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
      testID={`memory-tile-${index}`}
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
      accessibilityState={{ selected: isShowingFront, disabled }}
      aria-selected={isShowingFront}
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

// ══════════════════════════════════════════════════════════════════════════════
// MULTIPLAYER COMPETITIVE COMPONENT (SINGLE OWNER: useCompetitiveRound)
// ══════════════════════════════════════════════════════════════════════════════
function MemoryGridMultiplayerSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const rawDims = getGridDims(session);
  const players = session.players;

  const compRound = useCompetitiveRound({
    gameId: 'memory_grid',
    mode: session.mode,
    players: session.players,
    roundDurationSeconds: 90,
    countdownSeconds: 5,
    roundConfig: { cols: rawDims.cols, rows: rawDims.rows, gridSize: session.gameConfig?.gridSize },
  });

  // Frozen authoritative grid dimensions from host snapshot
  useGameActivity(players.find(p => p.id === compRound.localPlayerId)?.displayName, compRound.isLocallyCompleted ? 'complete' : compRound.phase);
  const { cols, rows } = getAuthoritativeGridDims(compRound.roundState, rawDims.cols, rawDims.rows);
  const PAIR_COUNT = Math.floor((cols * rows) / 2);

  // Local multiplayer state (each player solves independently)
  const [multiTiles, setMultiTiles] = useState<DeterministicMemoryTile[]>(() =>
    generateDeterministicMemoryGridBoard(cols, rows, compRound.seed)
  );
  const [multiFirstFlippedIndex, setMultiFirstFlippedIndex] = useState<number | null>(null);
  const [multiIsResolving, setMultiIsResolving] = useState(false);
  const [multiMatchedPairs, setMultiMatchedPairs] = useState(0);
  const [multiMoveCount, setMultiMoveCount] = useState(0);
  const [multiElapsedSecs, setMultiElapsedSecs] = useState(0);

  const activeMultiRoundIdRef = useRef<string>(compRound.roundState.roundId);
  const mismatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local board whenever a new competitive round starts
  useEffect(() => {
    if (compRound.roundState.roundId !== activeMultiRoundIdRef.current) {
      activeMultiRoundIdRef.current = compRound.roundState.roundId;
      if (mismatchTimeoutRef.current) {
        clearTimeout(mismatchTimeoutRef.current);
        mismatchTimeoutRef.current = null;
      }
      setMultiTiles(generateDeterministicMemoryGridBoard(cols, rows, compRound.seed));
      setMultiFirstFlippedIndex(null);
      setMultiIsResolving(false);
      setMultiMatchedPairs(0);
      setMultiMoveCount(0);
      setMultiElapsedSecs(0);
    }
  }, [compRound.roundState.roundId, compRound.seed, cols, rows]);

  // Clean up mismatch timer on unmount
  useEffect(() => {
    return () => {
      if (mismatchTimeoutRef.current) {
        clearTimeout(mismatchTimeoutRef.current);
        mismatchTimeoutRef.current = null;
      }
    };
  }, []);

  // Live timer for multiplayer derived from server-aligned scheduledStartAt
  useEffect(() => {
    if (!compRound.isAuthoritativeReady || compRound.phase !== 'playing' || compRound.isLocallyCompleted) return;

    const interval = setInterval(() => {
      const now = getServerNow();
      const startAt = compRound.roundState.scheduledStartAt;
      const elapsed = Math.max(0, (now - startAt) / 1000);
      setMultiElapsedSecs(+elapsed.toFixed(1));
    }, 100);

    return () => clearInterval(interval);
  }, [compRound.isAuthoritativeReady, compRound.phase, compRound.isLocallyCompleted, compRound.roundState.scheduledStartAt]);

  // Skip / Give Up handler for multiplayer
  useEffect(() => {
    if (compRound.isAuthoritativeReady && compRound.phase === 'playing' && !compRound.isLocallyCompleted) {
      const localPlayer = players.find(p => p.id === compRound.localPlayerId) || players[0];
      registerSkip(() => {
        if (mismatchTimeoutRef.current) {
          clearTimeout(mismatchTimeoutRef.current);
          mismatchTimeoutRef.current = null;
        }
        const now = getServerNow();
        compRound.submitResult({
          score: 999999,
          secondaryScore: multiMoveCount,
          completedAt: now,
          didFinish: false,
          details: { moves: multiMoveCount, matchedPairs: multiMatchedPairs, pairCount: PAIR_COUNT, gaveUp: true },
        });
      }, localPlayer?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [compRound.isAuthoritativeReady, compRound.phase, compRound.isLocallyCompleted, compRound.localPlayerId, multiMoveCount, multiMatchedPairs, PAIR_COUNT, players, registerSkip, compRound]);

  // Local tile flip handler in multiplayer (purely client-local)
  const handleMultiTileFlip = (index: number) => {
    if (!multiTiles[index] || multiIsResolving || compRound.isLocallyCompleted || compRound.phase !== 'playing') {
      return;
    }
    if (multiTiles[index].isFlipped || multiTiles[index].isMatched) {
      return;
    }

    Haptics.selectionAsync();

    const newTiles = [...multiTiles];
    newTiles[index] = { ...newTiles[index], isFlipped: true };
    setMultiTiles(newTiles);

    if (multiFirstFlippedIndex !== null) {
      const newMoveCount = multiMoveCount + 1;
      setMultiMoveCount(newMoveCount);

      if (newTiles[multiFirstFlippedIndex].pairId === newTiles[index].pairId) {
        // Match!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const matched = [...newTiles];
        matched[multiFirstFlippedIndex] = { ...matched[multiFirstFlippedIndex], isMatched: true };
        matched[index] = { ...matched[index], isMatched: true };
        setMultiTiles(matched);

        const newMatchedPairs = multiMatchedPairs + 1;
        setMultiMatchedPairs(newMatchedPairs);
        setMultiFirstFlippedIndex(null);

        if (newMatchedPairs >= PAIR_COUNT) {
          // Solved board completely!
          if (mismatchTimeoutRef.current) {
            clearTimeout(mismatchTimeoutRef.current);
            mismatchTimeoutRef.current = null;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const now = getServerNow();
          const rawElapsedMs = Math.max(1, Math.round(now - compRound.roundState.scheduledStartAt));
          compRound.submitResult({
            score: rawElapsedMs,
            secondaryScore: newMoveCount,
            completedAt: now,
            didFinish: true,
            details: {
              moves: newMoveCount,
              elapsedSecs: +(rawElapsedMs / 1000).toFixed(1),
              pairCount: PAIR_COUNT,
            },
          });
        }
      } else {
        // Mismatch!
        const capturedFirst = multiFirstFlippedIndex;
        const capturedSecond = index;
        setMultiIsResolving(true);
        setMultiFirstFlippedIndex(null);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        mismatchTimeoutRef.current = setTimeout(() => {
          setMultiTiles(prev => {
            const t = [...prev];
            if (t[capturedFirst]) t[capturedFirst] = { ...t[capturedFirst], isFlipped: false };
            if (t[capturedSecond]) t[capturedSecond] = { ...t[capturedSecond], isFlipped: false };
            return t;
          });
          setMultiIsResolving(false);
          mismatchTimeoutRef.current = null;
        }, 800);
      }
    } else {
      setMultiFirstFlippedIndex(index);
    }
  };

  const tileColor = (colorIndex: number) => TILE_COLORS[colorIndex % TILE_COLORS.length];
  const windowDims = Dimensions.get('window');
  const screenWidth = windowDims.width;
  const screenHeight = windowDims.height;
  const gridPadding = 24;
  const tileGap = 8;
  const maxGridWidth = 540;
  const availableWidth = Math.min(screenWidth - gridPadding * 2, maxGridWidth);
  const availableHeight = Math.max(300, screenHeight - 220);
  const maxTileByWidth = (availableWidth - tileGap * (cols - 1)) / cols;
  const maxTileByHeight = (availableHeight - tileGap * (rows - 1)) / rows;
  const tileSize = Math.max(40, Math.min(maxTileByWidth, maxTileByHeight, 110));

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds) % 60;
    const tenths = Math.floor((seconds * 10) % 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${secs}.${tenths}`;
  };

  // 0. Authoritative Startup Barrier: Guest waits for host snapshot
  if (!compRound.isAuthoritativeReady) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#5AC8FA" />
          <Text style={styles.title}>Syncing with Host...</Text>
          <Text style={styles.sub}>Waiting for host round to start</Text>
        </View>
      </View>
    );
  }

  // 1. Countdown Phase
  if (compRound.phase === 'countdown') {
    return (
      <PhaseTransition phaseKey="multi-countdown" style={styles.centerContent}>
        <View style={styles.iconContainer}>
          <IconSymbol name="square.grid.3x3.fill" size={48} color="#5AC8FA" />
        </View>
        <View style={styles.readyTextGroup}>
          <Text style={styles.readyTitle}>Memory Grid</Text>
          <Text style={styles.readySubtitle}>Match all {PAIR_COUNT} pairs</Text>
        </View>
        <View style={[styles.statBubble, { marginTop: 32 }]}>
          <Text style={[styles.statBubbleValue, { fontSize: 36, color: '#5AC8FA' }]}>
            {compRound.countdownRemaining}
          </Text>
          <Text style={styles.statBubbleLabel}>Game starts in</Text>
        </View>
      </PhaseTransition>
    );
  }

  // 2. Synchronized Active Play / Local Completion & Status
  if (compRound.phase === 'playing') {
    if (compRound.isLocallyCompleted) {
      const isGaveUp = compRound.pendingResult?.didFinish === false;
      const movesShown = compRound.pendingResult?.secondaryScore ?? multiMoveCount;
      const elapsedSecs = compRound.pendingResult?.details?.elapsedSecs
        ? `${compRound.pendingResult.details.elapsedSecs}s`
        : formatTime(multiElapsedSecs);

      return (
        <PhaseTransition phaseKey="multi-submitted" style={styles.container}>
          <View style={styles.centerContent}>
            <View style={[styles.iconContainer, { backgroundColor: isGaveUp ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)' }]}>
              <IconSymbol
                name={isGaveUp ? "flag.fill" : "checkmark.seal.fill"}
                size={54}
                color={isGaveUp ? Colors.red : Colors.green}
              />
            </View>
            <Text style={styles.title}>{isGaveUp ? 'Gave Up' : 'Grid Completed!'}</Text>
            <Text style={styles.sub}>
              {isGaveUp
                ? `${multiMatchedPairs}/${PAIR_COUNT} pairs · ${movesShown} moves`
                : `${elapsedSecs} · ${movesShown} moves`}
            </Text>

            {compRound.submissionStatus === 'error' && compRound.submissionError ? (
              <Pressable
                style={[styles.waitingBox, { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.3)', borderWidth: 1 }]}
                onPress={() => compRound.retrySubmission()}>
                <IconSymbol name="arrow.clockwise" size={16} color={Colors.red} />
                <Text style={[styles.waitingBoxText, { color: Colors.red }]}>
                  {compRound.submissionError} (Tap to retry)
                </Text>
              </Pressable>
            ) : compRound.submissionStatus === 'sending' ? (
              <View style={styles.waitingBox}>
                <ActivityIndicator size="small" color="#FF9500" />
                <Text style={[styles.waitingBoxText, { color: '#FF9500' }]}>
                  Delivering result to host...
                </Text>
              </View>
            ) : (
              <View style={styles.waitingBox}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.waitingBoxText}>
                  Waiting for other players... ({compRound.completedCount} / {compRound.totalPlayers})
                </Text>
              </View>
            )}
          </View>
        </PhaseTransition>
      );
    }

    const localPlayer = players.find(p => p.id === compRound.localPlayerId) || players[0];
    const multiProgress = PAIR_COUNT > 0 ? multiMatchedPairs / PAIR_COUNT : 0;

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.gameHeader}>
          <View style={{ flex: 1 }}>
            <SecondaryPlayerLabel name={localPlayer?.displayName}><Text style={styles.headerTitle}>{localPlayer?.displayName || 'Player'}</Text></SecondaryPlayerLabel>
            <Text style={styles.headerSubtitle}>{multiMatchedPairs}/{PAIR_COUNT} pairs</Text>
          </View>

          <View style={styles.statsGroup}>
            <View style={[styles.statPill, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
              <IconSymbol name="hand.tap.fill" size={12} color={Colors.orange} />
              <Text style={[styles.statPillText, { color: Colors.orange }]}>{multiMoveCount}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: 'rgba(90,200,250,0.1)' }]}>
              <IconSymbol name="timer" size={12} color="#5AC8FA" />
              <Text style={[styles.statPillText, { color: '#5AC8FA' }]}>{formatTime(multiElapsedSecs)}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#5AC8FA', '#007AFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${Math.max(multiProgress * 100, 1)}%` as any }]}
            />
          </View>
        </View>

        {/* Grid */}
        <View style={[styles.gridContainer, { paddingHorizontal: gridPadding - 12 }]}>
          <View style={[styles.grid, { gap: tileGap }]}>
            {multiTiles.map((tile, i) => {
              const color = tileColor(tile.colorIndex);
              return (
                <FlipTile
                  key={tile.id}
                  isFlipped={tile.isFlipped}
                  isMatched={tile.isMatched}
                  color={color}
                  symbol={tile.symbol}
                  size={tileSize}
                  onPress={() => handleMultiTileFlip(i)}
                  disabled={tile.isFlipped || tile.isMatched || multiIsResolving || compRound.isLocallyCompleted}
                  index={i}
                />
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // 3. Synchronized Results Phase
  const playerNamesMap = Object.fromEntries(players.map(p => [p.id, p.displayName]));
  const participantIds = compRound.roundState.participantIds?.length ? compRound.roundState.participantIds : players.map(p => p.id);
  const ranked = rankMemoryGridResults(compRound.results, participantIds, playerNamesMap);

  const entries: RankEntry[] = ranked.map(r => {
    const isSkipped = !r.didFinish;
    const timeSecs = r.details?.elapsedSecs ? `${r.details.elapsedSecs}s` : (r.score < 900000 ? formatTime(r.score / 1000) : 'DNF');
    return {
      id: r.playerId,
      name: r.displayName,
      isSkipped,
      elapsedSeconds: isSkipped ? 999999 : (r.score / 1000),
      moveCount: r.secondaryScore ?? 0,
      primary: isSkipped ? 'DNF' : timeSecs,
      secondary: isSkipped ? 'Did not finish' : `${r.secondaryScore ?? 0} moves`,
    };
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.resultsContent}>
        <ResultsScoreboard
          entries={entries}
          title="Final Rankings"
        />

        {compRound.isHost ? (
          <Pressable style={styles.primaryBtn} onPress={compRound.playAgain}>
            <Text style={styles.primaryBtnText}>Next Round</Text>
          </Pressable>
        ) : (
          <View style={[styles.waitingBox, { marginTop: 24 }]}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.waitingBoxText}>Waiting for host to start next round...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE-DEVICE PASS-AND-PLAY COMPONENT (LOCAL-ONLY STATE, NO MP CONSUMERS)
// ══════════════════════════════════════════════════════════════════════════════
function MemoryGridSingleDeviceSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const { cols, rows } = getGridDims(session);
  const PAIR_COUNT = Math.floor((cols * rows) / 2);
  const players = session.players;

  const [boardState, setBoardState] = useState({
    phase: 'ready' as SingleDevicePhase,
    currentPlayerIndex: 0,
    tiles: [] as SingleDeviceTile[],
    firstFlippedIndex: null as number | null,
    isResolving: false,
    matchedPairs: 0,
    moveCount: 0,
  });

  const { phase, currentPlayerIndex, tiles, firstFlippedIndex, isResolving, matchedPairs, moveCount } = boardState;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [playerTimes, setPlayerTimes] = useState<PlayerTime[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mismatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (mismatchTimer.current) clearTimeout(mismatchTimer.current); }, []);

  const currentPlayer = players[currentPlayerIndex];
  useGameActivity(currentPlayer?.displayName, phase);

  // Timer for single-device pass-and-play
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

  const generateSingleDeviceBoard = useCallback((): SingleDeviceTile[] => {
    const symbols = shuffleArray(TILE_SYMBOLS).slice(0, PAIR_COUNT);
    let board: SingleDeviceTile[] = [];
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
  }, [PAIR_COUNT]);

  // Single-device skip registration
  useEffect(() => {
    if (phase === 'playing') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (mismatchTimer.current) clearTimeout(mismatchTimer.current);
        setPlayerTimes(prev => [...prev, {
          playerId: currentPlayer.id,
          elapsedSeconds: 0,
          moveCount: 0,
          isSkipped: true,
        }]);
        const nextIndex = currentPlayerIndex + 1;
        if (nextIndex >= players.length) {
          setBoardState(prev => ({ ...prev, phase: 'results' }));
        } else {
          setBoardState(prev => ({ ...prev, currentPlayerIndex: nextIndex, phase: 'ready' }));
        }
      }, currentPlayer?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, currentPlayerIndex, currentPlayer, players.length, registerSkip]);

  const handleStart = (targetPlayerIdx?: number) => {
    if (mismatchTimer.current) clearTimeout(mismatchTimer.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const board = generateSingleDeviceBoard();
    const nextIdx = targetPlayerIdx !== undefined ? targetPlayerIdx : boardState.currentPlayerIndex;

    setBoardState({
      phase: 'playing',
      currentPlayerIndex: nextIdx,
      tiles: board,
      firstFlippedIndex: null,
      isResolving: false,
      matchedPairs: 0,
      moveCount: 0,
    });

    setElapsedSeconds(0);
  };

  const handleTileFlip = (index: number) => {
    if (!tiles[index] || isResolving) return;
    if (tiles[index].isFlipped || tiles[index].isMatched) return;

    Haptics.selectionAsync();

    const newTiles = [...tiles];
    newTiles[index] = { ...newTiles[index], isFlipped: true };

    setBoardState(prev => ({ ...prev, tiles: newTiles }));

    if (firstFlippedIndex !== null) {
      const newMoveCount = moveCount + 1;

      if (newTiles[firstFlippedIndex].pairId === newTiles[index].pairId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const matched = [...newTiles];
        matched[firstFlippedIndex] = { ...matched[firstFlippedIndex], isMatched: true };
        matched[index] = { ...matched[index], isMatched: true };

        const newMatchedPairs = matchedPairs + 1;
        setBoardState(prev => ({
          ...prev,
          tiles: matched,
          matchedPairs: newMatchedPairs,
          moveCount: newMoveCount,
          firstFlippedIndex: null,
        }));

        if (newMatchedPairs >= PAIR_COUNT) {
          handlePlayerComplete(newMoveCount);
        }
      } else {
        const capturedFirst = firstFlippedIndex;
        const capturedSecond = index;

        setBoardState(prev => ({
          ...prev,
          tiles: newTiles,
          moveCount: newMoveCount,
          isResolving: true,
          firstFlippedIndex: null,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        mismatchTimer.current = setTimeout(() => {
          setBoardState(prev => {
            const t = [...prev.tiles];
            t[capturedFirst] = { ...t[capturedFirst], isFlipped: false };
            t[capturedSecond] = { ...t[capturedSecond], isFlipped: false };
            return { ...prev, tiles: t, isResolving: false };
          });
        }, 800);
      }
    } else {
      setBoardState(prev => ({ ...prev, tiles: newTiles, firstFlippedIndex: index }));
    }
  };

  const handlePlayerComplete = (finalMoveCount: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setPlayerTimes(prev => [...prev, {
      playerId: currentPlayer.id,
      elapsedSeconds,
      moveCount: finalMoveCount,
    }]);

    const nextIndex = currentPlayerIndex + 1;
    if (nextIndex >= players.length) {
      setBoardState(prev => ({ ...prev, phase: 'results' }));
    } else {
      setBoardState(prev => ({ ...prev, phase: 'playerComplete' }));
    }
  };

  const handleNextPlayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleStart(currentPlayerIndex + 1);
  };

  const handlePlayAgain = () => {
    setPlayerTimes([]);
    setBoardState(prev => ({ ...prev, currentPlayerIndex: 0, phase: 'ready' }));
  };

  const tileColor = (colorIndex: number) => TILE_COLORS[colorIndex % TILE_COLORS.length];
  const windowDims = Dimensions.get('window');
  const screenWidth = windowDims.width;
  const screenHeight = windowDims.height;
  const gridPadding = 24;
  const tileGap = 8;
  const maxGridWidth = 540;
  const availableWidth = Math.min(screenWidth - gridPadding * 2, maxGridWidth);
  const availableHeight = Math.max(300, screenHeight - 220);
  const maxTileByWidth = (availableWidth - tileGap * (cols - 1)) / cols;
  const maxTileByHeight = (availableHeight - tileGap * (rows - 1)) / rows;
  const tileSize = Math.max(40, Math.min(maxTileByWidth, maxTileByHeight, 110));

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds) % 60;
    const tenths = Math.floor((seconds * 10) % 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${secs}.${tenths}`;
  };

  const progress = PAIR_COUNT > 0 ? matchedPairs / PAIR_COUNT : 0;

  // ──────────── READY VIEW ────────────
  if (phase === 'ready') {
    return (
      <PhaseTransition phaseKey={`ready-${currentPlayerIndex}`} style={{ flex: 1 }}>
        <GamePassPhoneView
          playerName={currentPlayer?.displayName || 'Player'}
          title={players.length > 1 && currentPlayerIndex > 0 ? "Pass the phone to" : "Get ready"}
          subtitle={`Memory Grid · ${cols}×${rows} · ${PAIR_COUNT} pairs`}
          accentColor="#5AC8FA"
          onReady={() => handleStart(currentPlayerIndex)}
          onSkip={() => {
            setPlayerTimes(prev => [...prev, {
              playerId: currentPlayer.id,
              elapsedSeconds: 0,
              moveCount: 0,
              isSkipped: true,
            }]);
            const nextIndex = currentPlayerIndex + 1;
            if (nextIndex >= players.length) {
              setBoardState(prev => ({ ...prev, phase: 'results' }));
            } else {
              setBoardState(prev => ({ ...prev, currentPlayerIndex: nextIndex, phase: 'ready' }));
            }
          }}
        />
      </PhaseTransition>
    );
  }

  // ──────────── PLAYING VIEW ────────────
  if (phase === 'playing') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.gameHeader}>
          <View style={{ flex: 1 }}>
            {players.length > 1 ? (
              <SecondaryPlayerLabel name={currentPlayer.displayName}><View style={styles.turnPill}>
                <Text style={styles.turnPillText}>Now · {currentPlayer.displayName}</Text>
              </View></SecondaryPlayerLabel>
            ) : (
              <Text style={styles.headerTitle}>Memory Grid</Text>
            )}
            <Text style={styles.headerSubtitle}>{matchedPairs}/{PAIR_COUNT} pairs</Text>
          </View>

          <View style={styles.statsGroup}>
            <View style={[styles.statPill, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
              <IconSymbol name="hand.tap.fill" size={12} color={Colors.orange} />
              <Text testID="memory-grid-move-count" style={[styles.statPillText, { color: Colors.orange }]}>{moveCount}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: 'rgba(90,200,250,0.1)' }]}>
              <IconSymbol name="timer" size={12} color="#5AC8FA" />
              <Text style={[styles.statPillText, { color: '#5AC8FA' }]}>{formatTime(elapsedSeconds)}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#5AC8FA', '#007AFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${Math.max(progress * 100, 1)}%` as any }]}
            />
          </View>
        </View>

        {/* Grid */}
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
                  onPress={() => handleTileFlip(i)}
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

  // ──────────── PLAYER COMPLETE HANDOFF ────────────
  if (phase === 'playerComplete') {
    const lastResult = playerTimes[playerTimes.length - 1];
    return (
      <GamePlayerCompleteView
        nextPlayerName={players[currentPlayerIndex + 1]?.displayName || 'Next Player'}
        prevResultLine={lastResult && !lastResult.isSkipped && lastResult.elapsedSeconds > 0 ? `${formatTime(lastResult.elapsedSeconds)} · ${lastResult.moveCount} moves` : 'Skipped turn'}
        onReady={handleNextPlayer}
        accentColor="#5AC8FA"
      />
    );
  }

  // ──────────── RESULTS VIEW ────────────
  const entries: RankEntry[] = players.map((player) => {
    const result = playerTimes.find(t => t.playerId === player.id);
    const isSkipped = !result || !!result.isSkipped || result.elapsedSeconds <= 0;
    return {
      id: player.id,
      name: player.displayName,
      isSkipped,
      elapsedSeconds: result?.elapsedSeconds ?? 999999,
      moveCount: result?.moveCount ?? 0,
      primary: isSkipped ? 'Skipped' : formatTime(result!.elapsedSeconds),
      secondary: isSkipped ? 'Did not play' : `${result!.moveCount} moves`,
    };
  }).sort((a, b) => {
    if (a.isSkipped !== b.isSkipped) return a.isSkipped ? 1 : -1;
    if (a.elapsedSeconds !== b.elapsedSeconds) return a.elapsedSeconds - b.elapsedSeconds;
    return a.moveCount - b.moveCount;
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

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTED ROOT COMPONENT (CLEANLY BRANCHED BY SESSION MODE)
// ══════════════════════════════════════════════════════════════════════════════
export function MemoryGridSession({ session }: Props) {
  if (session.mode === GameMode.multiDevice) {
    return <MemoryGridMultiplayerSession session={session} />;
  }
  return <MemoryGridSingleDeviceSession session={session} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultsContent: { padding: 16, paddingBottom: 40 },

  title: { color: 'white', fontSize: 26, fontFamily: 'Viral-Black', marginTop: 16, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 6, fontWeight: '600', textAlign: 'center' },

  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  waitingBoxText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },

  // Ready view
  iconContainer: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: 'rgba(90,200,250,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  readyTextGroup: { alignItems: 'center', marginTop: 20, gap: 8 },
  readyTitle: { color: 'white', fontSize: 28, fontFamily: 'Viral-Black' },
  readySubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: '600' },

  turnPill: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },
  turnPillText: { color: Colors.green, fontSize: 16, fontFamily: 'Viral-Black' },

  statBubble: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, minWidth: 80,
  },
  statBubbleValue: { color: 'white', fontSize: 22, fontFamily: 'Viral-Black' },
  statBubbleLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '600', marginTop: 2 },

  primaryBtn: {
    backgroundColor: '#007AFF', paddingVertical: 18,
    width: '100%', maxWidth: 540, alignSelf: 'center', alignItems: 'center', marginTop: 32, minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  primaryBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // Game header
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 12,
    maxWidth: 540, width: '100%', alignSelf: 'center',
  },
  headerTitle: { color: 'white', fontSize: 24, fontFamily: 'Viral-Black' },
  headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '600', marginTop: 4 },
  statsGroup: { flexDirection: 'row', gap: 10 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
  },
  statPillText: { fontSize: 16, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },

  // Progress bar
  progressBarContainer: { paddingHorizontal: 16, paddingBottom: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },

  // Grid
  gridContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 4, maxWidth: 540, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'center' },
  tileWrapper: {},
  tileFront: {
    flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  tileBack: {
    flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(90,200,250,0.4)',
  },
});
