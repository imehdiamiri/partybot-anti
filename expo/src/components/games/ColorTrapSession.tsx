import { Colors, Typography } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { GamePassPhoneView, GameResultsScreen, GamePlayerCompleteView, playSharedSound } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';

interface Props { session: GameSession; }
type Phase = 'ready' | 'playing' | 'playerComplete' | 'results';

const PALETTE = [Colors.red, '#007AFF', Colors.green, Colors.yellow, '#AF52DE'];
const PALETTE_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

interface Spawn { id: number; appearAt: number; xPercent: number; yPercent: number; colorIndex: number; size: number; }
interface ActiveTile {
  id: number; spawnedAt: number; xPercent: number; yPercent: number;
  colorIndex: number; size: number; isHit: boolean;
}
interface PlayerResult {
  playerId: string; hits: number; misses: number; mistakes: number; score: number;
}

// Difficulty definitions
const DIFFICULTIES = {
  easy: { spawnInterval: 0.9, tileLifetime: 2.0, totalDuration: 20, label: 'Easy' },
  medium: { spawnInterval: 0.65, tileLifetime: 1.6, totalDuration: 30, label: 'Medium' },
  hard: { spawnInterval: 0.45, tileLifetime: 1.2, totalDuration: 45, label: 'Hard' },
  extreme: { spawnInterval: 0.3, tileLifetime: 0.85, totalDuration: 60, label: 'Extreme' },
};

type Difficulty = keyof typeof DIFFICULTIES;

function generateSpawns(diff: typeof DIFFICULTIES.medium, seed: number): Spawn[] {
  const spawns: Spawn[] = [];
  let t = 0.5; let id = 0;
  const rng = seedRng(seed);
  while (t < diff.totalDuration) {
    spawns.push({
      id: id++,
      appearAt: t,
      xPercent: 10 + rng() * 80,
      yPercent: 5 + rng() * 90,
      colorIndex: Math.floor(rng() * 5),
      size: 0.85 + rng() * 0.3,
    });
    t += diff.spawnInterval * (0.7 + rng() * 0.6);
  }
  return spawns;
}

/** Minimum centre-to-centre distance between circles (in percent of screen) */
const MIN_DIST_PCT = 22;

function seedRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/* ─── Animated Circle ─────────────────────────────────── */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AnimatedCircle({
  tile, lifetime, tileSize, color, onTap,
}: {
  tile: ActiveTile; lifetime: number;
  tileSize: number; color: string; onTap: (id: number) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: lifetime * 1000,
      easing: Easing.linear,
    });
  }, [lifetime]);

  const finalSize = tileSize * tile.size;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    let scale = 1;
    let opacity = 1;

    if (p < 0.15) {
      // Appear: smooth spring-like ease
      const t = p / 0.15;
      scale = t * t * (3 - 2 * t);
      opacity = t;
    } else if (p > 0.75) {
      // Disappear: gentle fade + shrink
      const t = (p - 0.75) / 0.25;
      const eased = t * t;
      scale = 1 - eased * 0.4;
      opacity = 1 - eased;
    }

    return {
      opacity,
      transform: [
        { translateX: -finalSize / 2 },
        { translateY: -finalSize / 2 },
        { scale },
      ],
    };
  });

  return (
    <AnimatedPressable
      onPress={() => onTap(tile.id)}
      style={[
        st.circleTile,
        {
          left: `${tile.xPercent}%`,
          top: `${tile.yPercent}%`,
          width: finalSize,
          height: finalSize,
          borderRadius: finalSize / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export function ColorTrapSession({ session }: Props) {
  const registerSkip = useRegisterSkip();
  const players = session.players;
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const d = session.gameConfig?.difficulty;
    if (d === 'easy' || d === 'medium' || d === 'hard' || d === 'extreme') return d;
    return 'medium';
  });
  const [results, setResults] = useState<PlayerResult[]>([]);

  // Game state
  const [forbiddenIdx, setForbiddenIdx] = useState(() => Math.floor(Math.random() * 5));
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const [activeTiles, setActiveTiles] = useState<ActiveTile[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);   // expired non-forbidden circles
  const [mistakes, setMistakes] = useState(0); // tapped forbidden circles

  const timerProgress = useSharedValue(1);
  const timerAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${timerProgress.value * 100}%`,
    };
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnCursorRef = useRef(0);
  const elapsedRef = useRef(0);
  const activeTilesRef = useRef<ActiveTile[]>([]);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const mistakesRef = useRef(0);
  const gameActiveRef = useRef(false);

  const diff = DIFFICULTIES[difficulty];
  const player = players[playerIdx];

  const sw = Dimensions.get('window').width;
  const tileSize = sw * 0.20;

  const startGame = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seed = Date.now();
    const sp = generateSpawns(diff, seed);
    setSpawns(sp);
    setActiveTiles([]);
    setElapsed(0);
    setHits(0);
    setMisses(0);
    setMistakes(0);
    hitsRef.current = 0;
    missesRef.current = 0;
    mistakesRef.current = 0;
    spawnCursorRef.current = 0;
    elapsedRef.current = 0;
    activeTilesRef.current = [];
    gameActiveRef.current = true;

    // Start UI-thread timer animation
    timerProgress.value = 1;
    timerProgress.value = withTiming(0, {
      duration: diff.totalDuration * 1000,
      easing: Easing.linear,
    });

    tickRef.current = setInterval(() => {
      if (!gameActiveRef.current) return;
      const step = 0.1;
      elapsedRef.current += step;
      setElapsed(elapsedRef.current);

      // Spawn new circles with collision avoidance
      while (spawnCursorRef.current < sp.length && sp[spawnCursorRef.current].appearAt <= elapsedRef.current) {
        const s = sp[spawnCursorRef.current];
        let xP = s.xPercent;
        let yP = s.yPercent;

        // Try to find a non-overlapping position
        let attempts = 0;
        const localRng = seedRng(s.id * 997 + Date.now());
        while (attempts < 20) {
          let overlaps = false;
          for (const existing of activeTilesRef.current) {
            if (existing.isHit) continue;
            const dx = xP - existing.xPercent;
            const dy = yP - existing.yPercent;
            if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST_PCT) {
              overlaps = true;
              break;
            }
          }
          if (!overlaps) break;
          xP = 10 + localRng() * 80;
          yP = 5 + localRng() * 90;
          attempts++;
        }

        activeTilesRef.current.push({ ...s, xPercent: xP, yPercent: yP, spawnedAt: elapsedRef.current, isHit: false });
        spawnCursorRef.current++;
      }

      // Expire circles
      const lt = diff.tileLifetime;
      const expiring = activeTilesRef.current.filter(tile =>
        !tile.isHit && (elapsedRef.current - tile.spawnedAt) >= lt
      );

      // Non-forbidden expired = miss (player failed to tap)
      for (const tile of expiring) {
        if (tile.colorIndex !== forbiddenIdx) {
          missesRef.current++;
          setMisses(missesRef.current);
        }
      }

      // Keep only active unhit circles within their lifetime
      activeTilesRef.current = activeTilesRef.current.filter(tile => {
        if (tile.isHit) return false;
        if ((elapsedRef.current - tile.spawnedAt) >= lt) return false;
        return true;
      });

      setActiveTiles([...activeTilesRef.current]);

      // Check game duration
      if (elapsedRef.current >= diff.totalDuration) {
        finishGame();
      }
    }, 100);

    setPhase('playing');
  };

  const finishGame = useCallback(() => {
    gameActiveRef.current = false;
    if (tickRef.current) clearInterval(tickRef.current);
    timerProgress.value = 0;
    const h = hitsRef.current;
    const mi = missesRef.current;
    const mk = mistakesRef.current;
    const score = Math.max(0, h * 10 - mi * 5 - mk * 15);
    setResults(prev => [...prev, {
      playerId: player.id, hits: h, misses: mi, mistakes: mk, score,
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
      // Wrong! Tapped the forbidden color → mistake
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      mistakesRef.current++;
      setMistakes(mistakesRef.current);
    } else {
      // Correct!
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      hitsRef.current++;
      setHits(hitsRef.current);
    }

    // Remove hit tile immediately from the active tiles
    activeTilesRef.current = activeTilesRef.current.filter(t => t.id !== tileId);
    setActiveTiles([...activeTilesRef.current]);
  };

  useEffect(() => {
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    if (phase === 'playing') {
      registerSkip(() => {
        gameActiveRef.current = false;
        if (tickRef.current) clearInterval(tickRef.current);
        timerProgress.value = 0;
        setResults(prev => [...prev, {
          playerId: player.id, hits: 0, misses: 0, mistakes: 0, score: 0,
        }]);
        if (playerIdx + 1 >= players.length) setPhase('results');
        else setPhase('playerComplete');
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIdx, player, players.length]);

  // ═══ READY ═══
  if (phase === 'ready') {
    const forbiddenColor = PALETTE[forbiddenIdx];
    const forbiddenName = PALETTE_NAMES[forbiddenIdx];
    return (
      <PhaseTransition phaseKey="ready" style={st.container}>
        <View style={st.readyScreen}>
          {/* Big forbidden color display */}
          <View style={st.readyTop}>
            <Text style={st.readyTitle}>
              {players.length > 1 && playerIdx > 0 ? 'Pass the phone to' : 'GET READY'}
            </Text>
            <Text style={st.readyPlayerName}>{player.displayName}</Text>
          </View>

          <View style={st.readyCenter}>
            {/* Glowing forbidden circle */}
            <View style={[st.readyGlow, { backgroundColor: forbiddenColor + '15' }]}>
              <View style={[st.readyGlowInner, { backgroundColor: forbiddenColor + '25' }]}>
                <View style={[st.readyForbiddenCircle, { backgroundColor: forbiddenColor }]}>
                  <IconSymbol name="xmark" size={44} color="white" weight="black" />
                </View>
              </View>
            </View>

            <Text style={st.readyWarningLabel}>DON'T TAP</Text>
            <Text style={[st.readyColorName, { color: forbiddenColor }]}>{forbiddenName}</Text>
            <Text style={st.readyHint}>Tap every other color as fast as you can!</Text>

            {/* Color palette preview */}
            <View style={st.readyPalette}>
              {PALETTE.map((color, i) => (
                <View key={i} style={st.readyPaletteItem}>
                  <View style={[
                    st.readyPaletteDot,
                    { backgroundColor: color },
                    i === forbiddenIdx && st.readyPaletteForbidden,
                  ]}>
                    {i === forbiddenIdx && (
                      <IconSymbol name="xmark" size={12} color="white" weight="black" />
                    )}
                    {i !== forbiddenIdx && (
                      <IconSymbol name="checkmark" size={12} color="white" weight="black" />
                    )}
                  </View>
                  <Text style={[
                    st.readyPaletteName,
                    i === forbiddenIdx && { color: forbiddenColor, fontWeight: '900' as any },
                  ]}>{PALETTE_NAMES[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={[st.readyBtn, { backgroundColor: forbiddenColor }]} onPress={startGame}>
            <Text style={st.readyBtnText}>I'm Ready</Text>
            <IconSymbol name="arrow.right" size={18} color="white" weight="bold" />
          </Pressable>
          <Pressable
            style={{ alignItems: 'center', marginTop: 16, paddingVertical: 8 }}
            onPress={() => {
              // Record score 0 / skipped result for this player
              setResults(prev => [...prev, {
                playerId: player.id, hits: 0, misses: 0, mistakes: 0, score: 0,
              }]);
              if (playerIdx + 1 >= players.length) {
                setPhase('results');
              } else {
                setPlayerIdx(i => i + 1);
                setForbiddenIdx(Math.floor(Math.random() * 5));
                setPhase('ready');
              }
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' }}>Skip this player</Text>
          </Pressable>
        </View>
      </PhaseTransition>
    );
  }

  // ═══ PLAYING ═══
  if (phase === 'playing') {
    const timeLeft = Math.max(0, diff.totalDuration - elapsed);
    const currentScore = Math.max(0, hits * 10 - misses * 5 - mistakes * 15);
    const forbiddenColor = PALETTE[forbiddenIdx];
    return (
      <PhaseTransition phaseKey="playing" style={st.container}>
        {/* Compact header with forbidden color accent */}
        <View style={[st.header, { borderBottomWidth: 3, borderBottomColor: forbiddenColor + '40' }]}>
          <View style={st.headerLeft}>
            <View style={[st.forbiddenBadge, { backgroundColor: forbiddenColor + '20', borderColor: forbiddenColor + '50' }]}>
              <IconSymbol name="xmark" size={11} color={forbiddenColor} weight="black" />
              <View style={[st.forbiddenDot, { backgroundColor: forbiddenColor }]} />
              <Text style={[st.forbiddenBadgeText, { color: forbiddenColor }]}>{PALETTE_NAMES[forbiddenIdx]}</Text>
            </View>
          </View>
          <View style={st.headerRight}>
            <Text style={st.scoreLabel}>SCORE</Text>
            <Text style={st.scoreTx}>{currentScore}</Text>
          </View>
        </View>

        {/* Timer bar */}
        <View style={st.timerBar}>
          <Animated.View style={[st.timerFill, { backgroundColor: forbiddenColor }, timerAnimatedStyle]} />
        </View>

        {/* Stats */}
        <View style={st.statsRow}>
          <View style={[st.statPill, { backgroundColor: Colors.green + '18' }]}>
            <IconSymbol name="checkmark.circle.fill" size={14} color={Colors.green} />
            <Text style={[st.statValue, { color: Colors.green }]}>{hits}</Text>
          </View>
          <View style={st.statPill}>
            <IconSymbol name="clock.fill" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={[st.statValue, { color: '#fff' }]}>{Math.ceil(timeLeft)}s</Text>
          </View>
          {mistakes > 0 && (
            <View style={[st.statPill, { backgroundColor: Colors.red + '18' }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color={Colors.red} />
              <Text style={[st.statValue, { color: Colors.red }]}>{mistakes}</Text>
            </View>
          )}
          {misses > 0 && (
            <View style={[st.statPill, { backgroundColor: Colors.orange + '18' }]}>
              <IconSymbol name="xmark.circle.fill" size={14} color={Colors.orange} />
              <Text style={[st.statValue, { color: Colors.orange }]}>{misses}</Text>
            </View>
          )}
        </View>

        {/* Arena */}
        <View style={[st.arena, { flex: 1, marginBottom: 24 }]}>
          {activeTiles.map(tile => (
            <AnimatedCircle
              key={tile.id}
              tile={tile}
              lifetime={diff.tileLifetime}
              tileSize={tileSize}
              color={PALETTE[tile.colorIndex]}
              onTap={handleTap}
            />
          ))}
        </View>

      </PhaseTransition>
    );
  }

  // ═══ PLAYER COMPLETE ═══
  if (phase === 'playerComplete') {
    const last = results[results.length - 1];
    const nextPlayer = players[playerIdx + 1];
    return (
      <GamePlayerCompleteView
        nextPlayerName={nextPlayer?.displayName || 'Next Player'}
        prevResultLine={`Score: ${last?.score} · ${last?.hits} hits`}
        onReady={() => { setPlayerIdx(i => i+1); setForbiddenIdx(Math.floor(Math.random() * 5)); startGame(); }}
        accentColor={PALETTE[forbiddenIdx]}
      />
    );
  }

  // ═══ RESULTS ═══
  const resultsData = results.map(r => ({
    playerId: r.playerId,
    score: r.score,
    stats: [
      { label: 'Hits', value: r.hits, color: Colors.green },
      { label: 'Missed', value: r.misses, color: r.misses > 0 ? Colors.orange : Colors.green },
      { label: 'Mistakes', value: r.mistakes, color: r.mistakes > 0 ? Colors.red : Colors.green },
    ]
  }));

  return (
    <GameResultsScreen
      players={players}
      results={resultsData}
      onPlayAgain={() => { setPlayerIdx(0); setResults([]); setForbiddenIdx(Math.floor(Math.random() * 5)); setPhase('ready'); }}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // ─── Ready Screen ───
  readyScreen: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
  readyTop: { alignItems: 'center', gap: 4 },
  readyTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  readyPlayerName: { color: '#fff', fontSize: 32, fontFamily: 'Viral-Black' },
  readyCenter: { alignItems: 'center', gap: 12 },
  readyGlow: {
    width: 180, height: 180, borderRadius: 90,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  readyGlowInner: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
  },
  readyForbiddenCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  readyWarningLabel: {
    color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '900',
    letterSpacing: 3, textTransform: 'uppercase',
  },
  readyColorName: { fontSize: 36, fontFamily: 'Viral-Black' },
  readyHint: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  readyPalette: {
    flexDirection: 'row', gap: 14, marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  readyPaletteItem: { alignItems: 'center', gap: 5 },
  readyPaletteDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  readyPaletteForbidden: {
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
  },
  readyPaletteName: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },
  readyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  readyBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // ─── Playing Header ───
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { alignItems: 'flex-end' },
  forbiddenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  forbiddenBadgeText: { fontSize: 14, fontFamily: 'Viral-Black' },
  forbiddenDot: { width: 14, height: 14, borderRadius: 7 },
  scoreLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  scoreTx: { color: '#fff', fontSize: 26, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] as any },
  timerBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16, borderRadius: 2, overflow: 'hidden',
  },
  timerFill: { height: 4, borderRadius: 2 },
  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
  },
  statValue: {
    color: 'rgba(255,255,255,0.6)', fontSize: 15,
    fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] as any,
  },
  arena: {
    backgroundColor: 'transparent',
    marginHorizontal: 8, borderRadius: 16,
    position: 'relative',
  },
  circleTile: {
    position: 'absolute', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
});

