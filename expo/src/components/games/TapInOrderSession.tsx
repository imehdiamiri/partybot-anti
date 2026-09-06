import { SecondaryPlayerLabel, useGameActivity } from './GameActivity';
import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Animated, ActivityIndicator } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { GameMode } from '@/src/models/AppModels';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { PhaseTransition } from './PhaseTransition';
import { GamePassPhoneView, GameReadyScreen, GameOutcomeCard, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { useCompetitiveRound } from '@/src/hooks/useCompetitiveRound';
import { generateDeterministicTapBoard, rankTapInOrderResults } from '@/src/models/CompetitiveRound';
import { getServerNow } from '@/src/services/ServerClock';

interface Props { session: GameSession; }
type Phase = 'ready' | 'preview' | 'playing' | 'outcome' | 'playerComplete' | 'results';
type MultiPlayPhase = 'preview' | 'playing' | 'done';
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
  const players = session.players;
  const isMultiplayer = session.mode === GameMode.multiDevice;

  // ─── MULTIPLAYER SYNC HOOK ───
  const compRound = useCompetitiveRound({
    gameId: session.game.id,
    mode: session.mode,
    players: session.players,
    tileCount: TILE_COUNT,
    roundDurationSeconds: 55,
    countdownSeconds: 5,
  });

  const localPlayerId = compRound.localPlayerId;
  const localPlayer = players.find(p => p.id === localPlayerId) || players.find(p => p.isLocal) || players[0];

  // Local multiplayer state
  const [multiPhase, setMultiPhase] = useState<MultiPlayPhase>('preview');
  const [multiElapsed, setMultiElapsed] = useState(0);
  const [multiPreviewLeft, setMultiPreviewLeft] = useState(0);
  const [multiTappedCells, setMultiTappedCells] = useState<Set<number>>(new Set());
  const [multiNextExpected, setMultiNextExpected] = useState(1);
  const [multiCorrectCount, setMultiCorrectCount] = useState(0);
  const [multiMissTaps, setMultiMissTaps] = useState(0);
  const [multiWrongFlash, setMultiWrongFlash] = useState<number | null>(null);

  // Single-device state
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIndex, setPlayerIndex] = useState(0);
  useGameActivity(isMultiplayer ? localPlayer?.displayName : players[playerIndex]?.displayName, isMultiplayer ? (compRound.isLocallyCompleted ? 'complete' : compRound.phase) : phase);

  // Board state for single-device
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

  const player = players[playerIndex];
  const totalTargets = isMultiplayer ? TILE_COUNT : selectedCells.length;
  const progressVal = totalTargets > 0 ? (isMultiplayer ? multiCorrectCount / totalTargets : correctCount / totalTargets) : 0;

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Deterministic multiplayer board
  const deterministicBoard = useMemo(() => {
    return generateDeterministicTapBoard(GRID_SIZE, TILE_COUNT, compRound.seed);
  }, [GRID_SIZE, TILE_COUNT, compRound.seed]);

  const previewDur = previewDuration(TILE_COUNT);
  const previewEndTimestamp = compRound.previewEndTimestamp || (compRound.roundState.scheduledStartAt + previewDur * 1000);

  // Handle multiplayer round setup & server-aligned absolute timing
  useEffect(() => {
    if (!isMultiplayer) return;

    if (compRound.phase === 'countdown') {
      setMultiPhase('preview');
      setMultiElapsed(0);
      setMultiPreviewLeft(previewDur);
      setMultiTappedCells(new Set());
      setMultiNextExpected(1);
      setMultiCorrectCount(0);
      setMultiMissTaps(0);
      setMultiWrongFlash(null);
      progressAnim.setValue(0);
      return;
    }

    if (compRound.phase === 'playing' && !compRound.localSubmitted) {
      const interval = setInterval(() => {
        const now = getServerNow();
        if (now < compRound.roundState.scheduledStartAt) {
          return;
        }

        if (now < previewEndTimestamp) {
          // Preview phase
          setMultiPhase('preview');
          const left = Math.max(0, +((previewEndTimestamp - now) / 1000).toFixed(1));
          setMultiPreviewLeft(left);
          const pProgress = Math.max(0, Math.min(1, 1 - left / previewDur));
          progressAnim.setValue(pProgress);
        } else {
          // Active playing phase
          setMultiPhase('playing');
          const elapsedSecs = Math.max(0, +((now - previewEndTimestamp) / 1000).toFixed(1));
          setMultiElapsed(elapsedSecs);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isMultiplayer, compRound.phase, compRound.localSubmitted, compRound.roundState.roundId, compRound.roundState.scheduledStartAt, previewEndTimestamp, previewDur, progressAnim]);

  // Single-device preview animation
  useEffect(() => {
    if (isMultiplayer) return;
    if (phase === 'preview' && previewLeft > 0) {
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
  }, [isMultiplayer, phase, previewLeft, previewTotal, progressAnim]);

  // Single-device play timer
  useEffect(() => {
    if (isMultiplayer) return;
    if (phase === 'playing') {
      progressAnim.setValue(0);
      timerRef.current = setInterval(() => setElapsed(p => +(p + 0.1).toFixed(1)), 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isMultiplayer, phase, progressAnim]);

  useEffect(() => {
    if (isMultiplayer) {
      registerSkip(null);
      return;
    }
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
  }, [isMultiplayer, phase, playerIndex, player, players.length, TILE_COUNT, registerSkip]);

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

  const handleMultiTap = (cellIndex: number) => {
    if (multiPhase !== 'playing' || compRound.localSubmitted) return;
    if (multiTappedCells.has(cellIndex)) return;

    const num = deterministicBoard.numberForCell[cellIndex];
    if (num === multiNextExpected) {
      // Correct
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newTapped = new Set(multiTappedCells);
      newTapped.add(cellIndex);
      setMultiTappedCells(newTapped);
      setMultiNextExpected(prev => prev + 1);
      const newCorrect = multiCorrectCount + 1;
      setMultiCorrectCount(newCorrect);

      if (newCorrect >= TILE_COUNT) {
        // Complete!
        setMultiPhase('done');
        const now = getServerNow();
        const rawTimeMs = Math.max(1, Math.round(now - previewEndTimestamp));
        const score = rawTimeMs + multiMissTaps * 1000;
        compRound.submitResult({
          score,
          secondaryScore: multiMissTaps,
          completedAt: now,
          didFinish: true,
          details: { rawTimeMs, missTaps: multiMissTaps, correctCount: newCorrect },
        });
      } else {
        Animated.timing(progressAnim, {
          toValue: newCorrect / TILE_COUNT,
          duration: 150,
          useNativeDriver: false,
        }).start();
      }
    } else {
      // Wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMultiMissTaps(prev => prev + 1);
      setMultiWrongFlash(cellIndex);
      setTimeout(() => setMultiWrongFlash(null), 300);
    }
  };

  const handleMultiGiveUp = () => {
    setMultiPhase('done');
    const now = getServerNow();
    const rawTimeMs = Math.max(1, Math.round(now - previewEndTimestamp));
    compRound.submitResult({
      score: 999999,
      secondaryScore: multiMissTaps,
      completedAt: now,
      didFinish: false,
      details: { rawTimeMs, missTaps: multiMissTaps, correctCount: multiCorrectCount },
    });
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
        handleComplete(true, newCorrect);
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

  const handleComplete = (didWin: boolean, finalCorrectCount = correctCount) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewRef.current) clearInterval(previewRef.current);

    setResults(prev => [...prev, {
      playerId: player.id, missTaps, timeMs: elapsed * 1000,
      correctCount: finalCorrectCount, totalTargets, didFinish: didWin,
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

  const { width: sw, height: sh } = useWindowDimensions();
  const spacing = 6;
  const maxGridByHeight = Math.max(260, sh - 320);
  const gridW = Math.min(Math.min(sw - 48, 400), maxGridByHeight);
  const tileSz = (gridW - spacing * (GRID_SIZE - 1)) / GRID_SIZE;

  // ══════════════════════════════════════════════════════════
  // MULTIPLAYER MODES
  // ══════════════════════════════════════════════════════════
  if (isMultiplayer) {
    // 1. Synchronized Countdown
    if (compRound.phase === 'countdown') {
      return (
        <PhaseTransition phaseKey="multi-countdown" style={st.container}>
          <View style={st.center}>
            <View style={[st.iconBox, { backgroundColor: 'rgba(255,149,0,0.15)' }]}>
              <IconSymbol name="number.square.fill" size={54} color={Colors.orange} />
            </View>
            <Text style={st.title}>Get Ready!</Text>
            <Text style={st.sub}>Memorize the numbers, then tap 1 to {TILE_COUNT} in order.</Text>
            <View style={st.countdownCircle}>
              <Text style={st.countdownNum}>{compRound.countdownRemaining}</Text>
            </View>
            <Text style={st.waitingSub}>Same board for all devices · Starting soon...</Text>
          </View>
        </PhaseTransition>
      );
    }

    // 2. Synchronized Active Play / Waiting for other players
    if (compRound.phase === 'playing') {
      if (compRound.isLocallyCompleted || multiPhase === 'done') {
        const isGaveUp = compRound.pendingResult?.didFinish === false;
        const correctShown = compRound.pendingResult?.details?.correctCount ?? multiCorrectCount;
        const missShown = compRound.pendingResult?.secondaryScore ?? multiMissTaps;
        const elapsedSecs = compRound.pendingResult?.details?.rawTimeMs
          ? (compRound.pendingResult.details.rawTimeMs / 1000).toFixed(1)
          : formatTime(multiElapsed);

        return (
          <PhaseTransition phaseKey="multi-submitted" style={st.container}>
            <View style={st.center}>
              <View style={[st.iconBox, { backgroundColor: isGaveUp ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)' }]}>
                <IconSymbol 
                  name={isGaveUp ? "flag.fill" : "checkmark.seal.fill"} 
                  size={54} 
                  color={isGaveUp ? Colors.red : Colors.green} 
                />
              </View>
              <Text style={st.title}>{isGaveUp ? 'Gave Up' : 'Board Completed!'}</Text>
              <Text style={st.sub}>
                {isGaveUp
                  ? `${correctShown}/${TILE_COUNT} tiles · ${missShown} mistakes`
                  : `${elapsedSecs}s · ${missShown} mistakes`}
              </Text>
              {compRound.submissionStatus === 'error' && compRound.submissionError ? (
                <Pressable
                  style={[st.waitingBox, { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.3)', borderWidth: 1 }]}
                  onPress={() => compRound.retrySubmission()}>
                  <IconSymbol name="arrow.clockwise" size={16} color={Colors.red} />
                  <Text style={[st.waitingBoxText, { color: Colors.red }]}>
                    {compRound.submissionError} (Tap to retry)
                  </Text>
                </Pressable>
              ) : compRound.submissionStatus === 'sending' ? (
                <View style={st.waitingBox}>
                  <ActivityIndicator size="small" color="#FF9500" />
                  <Text style={[st.waitingBoxText, { color: '#FF9500' }]}>
                    Delivering result to host...
                  </Text>
                </View>
              ) : (
                <View style={st.waitingBox}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={st.waitingBoxText}>
                    Waiting for other players... ({compRound.completedCount} / {compRound.totalPlayers})
                  </Text>
                </View>
              )}
            </View>
          </PhaseTransition>
        );
      }

      const isMultiPreview = multiPhase === 'preview';
      const previewDur = previewDuration(TILE_COUNT);

      return (
        <PhaseTransition phaseKey={`multi-play-${multiPhase}`} type="fade" style={st.container}>
          {/* Header */}
          <View style={st.topBar}>
            <View style={{ flex: 1 }}>
              <SecondaryPlayerLabel name={localPlayer?.displayName}><Text style={st.hName}>{localPlayer?.displayName || 'Player'}</Text></SecondaryPlayerLabel>
              <Text style={st.hSub}>
                {isMultiPreview ? 'Memorize the numbers...' : `Next: ${multiNextExpected} · ${multiMissTaps} mistakes`}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={st.statsRow}>
            <View style={[st.statCard, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
              <View style={st.statCardInner}>
                <IconSymbol name="xmark.circle.fill" size={12} color={Colors.red} />
                <Text style={[st.statVal, { color: Colors.red }]}>{multiMissTaps}</Text>
              </View>
              <Text style={st.statLbl}>Mistakes</Text>
            </View>
            <View style={[st.statCard, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
              <View style={st.statCardInner}>
                <IconSymbol name="checkmark.seal.fill" size={12} color={Colors.green} />
                <Text style={[st.statVal, { color: Colors.green }]}>{multiCorrectCount}/{TILE_COUNT}</Text>
              </View>
              <Text style={st.statLbl}>Correct</Text>
            </View>
            <View style={[st.statCard, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
              <View style={st.statCardInner}>
                <IconSymbol name={isMultiPreview ? 'eye.fill' : 'timer'} size={12} color={Colors.orange} />
                <Text style={[st.statVal, { color: Colors.orange }]}>
                  {isMultiPreview ? multiPreviewLeft.toFixed(1) : formatTime(multiElapsed)}
                </Text>
              </View>
              <Text style={st.statLbl}>{isMultiPreview ? 'Preview' : 'Time'}</Text>
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
                backgroundColor: isMultiPreview ? undefined : Colors.green,
              }]}>
                {isMultiPreview && (
                  <LinearGradient colors={[Colors.orange, '#FF2D55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1, borderRadius: 3 }} />
                )}
              </Animated.View>
            </View>
          </View>

          {/* Grid */}
          <View style={[st.gridWrap, { width: gridW }]}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const isSelected = deterministicBoard.selectedCells.includes(idx);
              const isTapped = multiTappedCells.has(idx);
              const isWrong = multiWrongFlash === idx;
              const num = deterministicBoard.numberForCell[idx];
              const tappedCorrect = isTapped && num !== undefined;
              const tappedWrongPersist = isTapped && !isSelected;

              let colors: [string, string] = ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)'];
              let borderColor = 'rgba(255,255,255,0.2)';
              let numColor = 'rgba(255,255,255,0.8)';

              if (isMultiPreview && isSelected) {
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
                <Pressable key={idx} testID={`tap-cell-${idx}`} accessibilityRole="button" onPress={() => handleMultiTap(idx)}
                  disabled={isMultiPreview || isTapped}
                  style={{ width: tileSz, height: tileSz }}>
                  <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[st.tile, { borderColor }, isWrong && { transform: [{ scale: 0.92 }] }]}>
                    {isMultiPreview && num !== undefined && (
                      <Text style={[st.tileNum, { color: numColor }]}>{num}</Text>
                    )}
                    {!isMultiPreview && tappedCorrect && num !== undefined && (
                      <Text style={[st.tileNum, { color: numColor, fontSize: 20 }]}>{num}</Text>
                    )}
                    {!isMultiPreview && tappedWrongPersist && (
                      <IconSymbol name="xmark" size={18} color="rgba(255,255,255,0.8)" />
                    )}
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>

          {/* Give Up button */}
          {multiPhase === 'playing' && (
            <Pressable style={st.giveUp} onPress={handleMultiGiveUp}>
              <IconSymbol name="flag.fill" size={14} color={Colors.red} />
              <Text style={st.giveUpTx}>Give Up</Text>
            </Pressable>
          )}
        </PhaseTransition>
      );
    }

    // 3. Synchronized Results
    if (compRound.phase === 'results') {
      const playerNamesMap = Object.fromEntries(players.map(p => [p.id, p.displayName]));
      const participantIds = compRound.roundState.participantIds?.length ? compRound.roundState.participantIds : players.map(p => p.id);
      const ranked = rankTapInOrderResults(
        compRound.results,
        participantIds,
        playerNamesMap
      );

      const entries: RankEntry[] = ranked.map(r => ({
        id: r.playerId,
        name: r.displayName,
        isSkipped: !r.didFinish,
        primary: r.didFinish ? `${(r.score / 1000).toFixed(1)}s` : 'DNF',
        secondary: r.didFinish
          ? `${r.details?.correctCount ?? TILE_COUNT}/${TILE_COUNT} tiles · ${r.secondaryScore ?? 0} mistakes`
          : 'Did not finish',
      }));

      return (
        <PhaseTransition phaseKey="multi-results" type="fade" style={st.container}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <ResultsScoreboard
              entries={entries}
              title="Round Leaderboard"
              subtitle="Fastest completion time wins"
              shareGameName="Tap In Order"
              onPlayAgain={compRound.isHost ? compRound.playAgain : undefined}
              playAgainTitle="Next Round"
            />
          </ScrollView>
        </PhaseTransition>
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  // SINGLE-DEVICE (PASS & PLAY) FLOW
  // ══════════════════════════════════════════════════════════
  if (phase === 'ready') {
    return (
      <PhaseTransition phaseKey={`ready-${playerIndex}`} style={{ flex: 1 }}>
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
              setPhase('ready');
            }
          }}
        />
      </PhaseTransition>
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
            <SecondaryPlayerLabel name={player.displayName}><Text style={st.hName}>{player.displayName}</Text></SecondaryPlayerLabel>
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
              <Pressable key={idx} testID={`tap-cell-${idx}`} accessibilityRole="button" onPress={() => handleTap(idx)}
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
  const sorted = [...players]
    .map(p => {
      const r = results.find(x => x.playerId === p.id);
      const didFinish = !!r?.didFinish;
      return {
        player: p,
        result: r,
        didFinish,
        isSkipped: !didFinish,
      };
    })
    .sort((a, b) => {
      if (a.didFinish !== b.didFinish) return a.didFinish ? -1 : 1;
      if ((a.result?.missTaps ?? 0) !== (b.result?.missTaps ?? 0)) return (a.result?.missTaps ?? 0) - (b.result?.missTaps ?? 0);
      return (a.result?.timeMs ?? 999999) - (b.result?.timeMs ?? 999999);
    });

  return (
    <PhaseTransition phaseKey="results" type="fade" style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={sorted.map(({ player, result, isSkipped, didFinish }) => {
            const displayTime = result ? (result.timeMs / 1000).toFixed(1) : '0';
            return {
              id: player.id,
              name: player.displayName ?? 'Player',
              isSkipped,
              primary: didFinish ? `${displayTime}s` : 'Skipped',
              secondary: didFinish ? `${result!.correctCount}/${result!.totalTargets} correct · ${result!.missTaps} mistakes` : 'Did not finish',
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
  btn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 16, width: '100%', maxWidth: 540, alignSelf: 'center', alignItems: 'center', marginTop: 32 },
  btnTx: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, maxWidth: 540, width: '100%', alignSelf: 'center' },
  hName: { color: '#fff', fontSize: 28, fontFamily: 'Viral-Black' },
  hSub: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, maxWidth: 540, width: '100%', alignSelf: 'center' },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statCardInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statVal: { fontSize: 14, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  statLbl: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  progWrap: { paddingHorizontal: 16, paddingBottom: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  progBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: 6, borderRadius: 3 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'center' },
  tile: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  tileNum: { fontSize: 20, fontFamily: 'Viral-Black' },
  giveUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12, marginHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', maxWidth: 540, width: '100%', alignSelf: 'center' },
  giveUpTx: { color: Colors.red, fontSize: 18, fontWeight: '600' },
  overlayCard: { padding: 32, borderRadius: 24, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  rankFirst: { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rankNum: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 'bold' },
  rankName: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black' },
  rankDet: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 },
  countdownCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,149,0,0.2)',
    borderWidth: 2,
    borderColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  countdownNum: {
    color: '#fff',
    fontSize: 44,
    fontFamily: 'Viral-Black',
  },
  waitingSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 16,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  waitingBoxText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
});
