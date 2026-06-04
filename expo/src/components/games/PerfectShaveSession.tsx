import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Image } from 'react-native';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { GamePassPhoneView, GameResultsScreen, GamePlayerCompleteView, playSharedSound } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { PhaseTransition } from './PhaseTransition';

interface Props { session: GameSession; }
type Phase = 'ready' | 'playing' | 'playerComplete' | 'results';

const { width: SCREEN_W } = Dimensions.get('window');
const HEAD_SIZE = Math.min(SCREEN_W - 32, 340);
const HEAD_IMG_H = HEAD_SIZE; // square image

// Hair zone in the image (percentage-based for the 1024x1024 head image)
// Hair boundary: left 18%, right 82%, top 5%, bottom 70%
const HAIR_L_PCT = 0.18;
const HAIR_R_PCT = 0.82;
const HAIR_T_PCT = 0.05;
const HAIR_B_PCT = 0.70;

const HAIR_LEFT = HEAD_SIZE * HAIR_L_PCT;
const HAIR_RIGHT = HEAD_SIZE * HAIR_R_PCT;
const HAIR_W = HAIR_RIGHT - HAIR_LEFT;
const HAIR_TOP = HEAD_IMG_H * HAIR_T_PCT;
const HAIR_BOTTOM = HEAD_IMG_H * HAIR_B_PCT;
const HAIR_H = HAIR_BOTTOM - HAIR_TOP;
const RAZOR_W = HAIR_W * 0.12;
const SHAVE_MS = 350;

const HEAD_IMAGE = require('@/assets/images/perfect-shave-head.png');

// Skin tone matching the character in the image
const SKIN_COLOR = '#DEBA9A';

const DIFFICULTIES = {
  easy:   { speed: 55,  label: 'Easy' },
  normal: { speed: 110, label: 'Normal' },
  hard:   { speed: 200, label: 'Hard' },
};
type Difficulty = keyof typeof DIFFICULTIES;

interface ShavedStrip { x: number; w: number; }
interface PlayerResult {
  playerId: string; moves: number; time: number; percentage: number; score: number;
}

function computeCoverage(strips: ShavedStrip[], totalW: number): number {
  if (!strips.length) return 0;
  const sorted = [...strips].sort((a, b) => a.x - b.x);
  const merged: { l: number; r: number }[] = [];
  for (const s of sorted) {
    const l = Math.max(0, s.x);
    const r = Math.min(totalW, s.x + s.w);
    if (merged.length && l <= merged[merged.length - 1].r) {
      merged[merged.length - 1].r = Math.max(merged[merged.length - 1].r, r);
    } else merged.push({ l, r });
  }
  return Math.min(100, Math.round(merged.reduce((s, m) => s + m.r - m.l, 0) / totalW * 100));
}

export function PerfectShaveSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();
  const customSettings = (session as any).customSettings || {};
  const difficulty: Difficulty = (customSettings.difficulty as Difficulty) || 'normal';
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;

  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const player = players[playerIdx];

  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isShaving, setIsShaving] = useState(false);
  const [shavedStrips, setShavedStrips] = useState<ShavedStrip[]>([]);
  const [razorX, setRazorX] = useState(0);
  const [shaveY, setShaveY] = useState(0);
  const shaveXRef = useRef(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const razorRef = useRef<{ x: number; dir: 1 | -1 }>({ x: 0, dir: 1 });
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const shaveAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompleteRef = useRef(false);

  const percentage = useMemo(() => computeCoverage(shavedStrips, HAIR_W), [shavedStrips]);
  const isComplete = percentage >= 100;
  useEffect(() => { isCompleteRef.current = isComplete; }, [isComplete]);

  const startGame = useCallback(() => {
    setPhase('playing');
    setMoves(0); setElapsed(0); setIsShaving(false);
    setShavedStrips([]); setRazorX(0); setShaveY(0);
    razorRef.current = { x: 0, dir: 1 };
    isCompleteRef.current = false;
    lastFrameRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(e => e + 0.1), 100);
    startRazorLoop();
  }, [diff.speed]);

  const startRazorLoop = useCallback(() => {
    const loop = () => {
      const now = Date.now();
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      const r = razorRef.current;
      r.x += r.dir * diff.speed * dt;
      const maxX = HAIR_W - RAZOR_W;
      if (r.x >= maxX) { r.x = maxX; r.dir = -1; }
      if (r.x <= 0) { r.x = 0; r.dir = 1; }
      setRazorX(r.x);
      rafRef.current = requestAnimationFrame(loop);
    };
    lastFrameRef.current = Date.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [diff.speed]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (shaveAnimRef.current) clearTimeout(shaveAnimRef.current);
  }, []);

  // Register skip handler during 'playing' phase
  useEffect(() => {
    if (phase === 'playing') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (shaveAnimRef.current) clearTimeout(shaveAnimRef.current);
        setResults(prev => [...prev, { playerId: player.id, moves: 0, time: 0, percentage: 0, score: 0 }]);
        if (playerIdx < players.length - 1) { setPlayerIdx(i => i + 1); setPhase('ready'); }
        else setPhase('results');
      }, player.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIdx]);

  useEffect(() => {
    if (isComplete && phase === 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Success);
      playSharedSound('success');
      const t = Math.round(elapsed * 10) / 10;
      const score = Math.max(0, 1000 - moves * 50 - Math.floor(t * 10));
      setResults(prev => [...prev, { playerId: player.id, moves, time: t, percentage: 100, score }]);
      setTimeout(() => setPhase(playerIdx < players.length - 1 ? 'playerComplete' : 'results'), 800);
    }
  }, [isComplete, phase]);

  const handleTap = useCallback(() => {
    if (isShaving || isCompleteRef.current || phase !== 'playing') return;
    setIsShaving(true);
    setMoves(m => m + 1);
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startX = razorRef.current.x;
    shaveXRef.current = startX;
    setShaveY(0);
    const t0 = Date.now();
    const anim = () => {
      const p = Math.min(1, (Date.now() - t0) / SHAVE_MS);
      setShaveY(p * HAIR_H);
      if (p < 1) { shaveAnimRef.current = setTimeout(anim, 16); }
      else {
        setShavedStrips(prev => [...prev, { x: startX, w: RAZOR_W }]);
        setIsShaving(false); setShaveY(0);
        if (!isCompleteRef.current) { lastFrameRef.current = Date.now(); startRazorLoop(); }
      }
    };
    anim();
  }, [isShaving, phase, startRazorLoop]);

  // ═══ READY ═══
  if (phase === 'ready') {
    return (
      <GamePassPhoneView
        playerName={player.displayName}
        title={players.length > 1 && playerIdx > 0 ? "Pass the phone to" : "Get ready"}
        subtitle="Tap to shave! Cover 100% in the fewest moves."
        accentColor="#00C9A7"
        onReady={startGame}
        onSkip={() => {
          // Record a skipped result with score 0
          setResults(prev => [...prev, { playerId: player.id, moves: 0, time: 0, percentage: 0, score: 0 }]);
          if (playerIdx < players.length - 1) { setPlayerIdx(i => i + 1); setPhase('ready'); }
          else setPhase('results');
        }}
      />
    );
  }

  // ═══ PLAYING ═══
  if (phase === 'playing') {
    return (
      <PhaseTransition phaseKey="playing" style={st.container}>
        <View style={st.header}>
          <View style={st.statCol}>
            <Text style={st.statLabel}>MOVES</Text>
            <Text style={st.statVal}>{moves}</Text>
          </View>
          <View style={st.statCol}>
            <Text style={st.statLabel}>SHAVED</Text>
            <Text style={[st.statVal, { color: '#00C9A7' }]}>{percentage}%</Text>
          </View>
          <View style={st.statCol}>
            <Text style={st.statLabel}>TIME</Text>
            <Text style={st.statVal}>{elapsed.toFixed(1)}s</Text>
          </View>
        </View>

        <View style={st.progressBar}>
          <View style={[st.progressFill, { width: `${percentage}%` }]} />
        </View>

        <View style={st.diffBadge}>
          <IconSymbol name="speedometer" size={12} color="rgba(255,255,255,0.5)" />
          <Text style={st.diffText}>{diff.label}</Text>
        </View>

        <Pressable style={st.gameArea} onPress={handleTap}>
          <View style={[st.headContainer, { width: HEAD_SIZE, height: HEAD_IMG_H }]}>
            {/* Layer 1: Skin-colored base that shows through when hair is "shaved" */}
            <View style={[st.skinBase, {
              left: HAIR_LEFT, top: HAIR_TOP,
              width: HAIR_W, height: HAIR_H,
            }]} />

            {/* Layer 2: Head image with hair on top */}
            <Image source={HEAD_IMAGE} style={st.headImg} resizeMode="cover" />

            {/* Layer 3: Hair zone clipping container — shaved strips punch through the image */}
            <View style={[st.hairClipZone, {
              left: HAIR_LEFT, top: HAIR_TOP,
              width: HAIR_W, height: HAIR_H,
            }]}>
              {/* Shaved strips: these cover the hair image revealing skin beneath */}
              {shavedStrips.map((s, i) => (
                <View key={`s${i}`} style={{
                  position: 'absolute',
                  left: s.x, width: s.w + 0.5,
                  top: 0, height: HAIR_H,
                  backgroundColor: SKIN_COLOR,
                }} />
              ))}

              {/* Current shave animation */}
              {isShaving && (
                <View style={{
                  position: 'absolute',
                  left: shaveXRef.current, width: RAZOR_W,
                  top: 0, height: shaveY,
                  backgroundColor: SKIN_COLOR,
                }} />
              )}
            </View>

            {/* Razor or shaving razor — positioned relative to hair zone */}
            {!isShaving ? (
              <View style={[st.razorContainer, { left: HAIR_LEFT + razorX, top: HAIR_TOP - 14 }]}>
                <View style={[st.guideLine, { left: 0, height: HAIR_H + 28 }]} />
                <View style={[st.guideLine, { left: RAZOR_W, height: HAIR_H + 28 }]} />
                <View style={[st.razor, { width: RAZOR_W + 10, marginLeft: -5 }]}>
                  <View style={st.razorBlade} />
                  <View style={st.razorHandle}><View style={st.razorGrip} /></View>
                </View>
              </View>
            ) : (
              <View style={[st.razorContainer, {
                left: HAIR_LEFT + shaveXRef.current,
                top: HAIR_TOP + shaveY - 5,
              }]}>
                <View style={[st.razor, { width: RAZOR_W + 10, marginLeft: -5 }]}>
                  <View style={st.razorBlade} />
                </View>
              </View>
            )}
          </View>

          <Text style={st.tapHint}>
            {isShaving ? 'Shaving...' : 'Tap anywhere to shave!'}
          </Text>
        </Pressable>

      </PhaseTransition>
    );
  }

  // ═══ PLAYER COMPLETE ═══
  if (phase === 'playerComplete') {
    const last = results[results.length - 1];
    return (
      <GamePlayerCompleteView
        nextPlayerName={players[playerIdx + 1]?.displayName || 'Next Player'}
        prevResultLine={`${last?.moves} moves · ${last?.time}s`}
        onReady={() => { setPlayerIdx(i => i + 1); startGame(); }}
        accentColor="#00C9A7"
      />
    );
  }

  // ═══ RESULTS ═══
  return (
    <GameResultsScreen
      players={players}
      results={results.map(r => ({
        playerId: r.playerId, score: r.score,
        stats: [
          { label: 'Moves', value: r.moves, color: '#00C9A7' },
          { label: 'Time', value: `${r.time}s`, color: Colors.cyan },
          { label: 'Shaved', value: `${r.percentage}%`, color: Colors.green },
        ],
      }))}
      onPlayAgain={() => { setPlayerIdx(0); setResults([]); setPhase('ready'); }}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  statCol: { alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  statVal: { color: '#fff', fontSize: 24, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] as any },
  progressBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#00C9A7', borderRadius: 2 },
  diffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'center', marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  diffText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  gameArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headContainer: {
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  skinBase: {
    position: 'absolute',
    backgroundColor: SKIN_COLOR,
    zIndex: 0,
    borderRadius: 8,
  },
  headImg: {
    width: '100%', height: '100%',
    position: 'absolute', top: 0, left: 0,
    zIndex: 1,
  },
  hairClipZone: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 2,
  },
  razorContainer: { position: 'absolute', zIndex: 10 },
  guideLine: {
    position: 'absolute', top: 0, width: 0,
    borderStyle: 'dashed', borderWidth: 1.5,
    borderColor: 'rgba(0,201,167,0.7)', zIndex: 8,
  },
  razor: {
    height: 14, backgroundColor: '#D0D0D0', borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#B0B0B0', zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 5,
  },
  razorBlade: { width: '85%', height: 3, backgroundColor: '#F0F0F0', borderRadius: 1 },
  razorHandle: {
    position: 'absolute', top: 14, width: 8, height: 26,
    backgroundColor: '#6B4C3B', borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  razorGrip: { width: 5, height: 14, backgroundColor: '#5A3D2E', borderRadius: 2 },
  tapHint: {
    color: 'rgba(255,255,255,0.4)', fontSize: 14,
    fontWeight: '700', marginTop: 20, letterSpacing: 0.5,
  },
});
