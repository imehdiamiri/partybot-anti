import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, withRepeat, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { Colors } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props { session: GameSession; }

type Phase = 'ready' | 'listening' | 'result' | 'playerComplete' | 'results';

const ATTEMPTS_PER_PLAYER = 3;

interface Attempt { diffMs: number | null; } // null = missed / didn't tap
interface PlayerRecord { playerId: string; attempts: Attempt[]; }

type DrumMode = 'whitney' | 'metronome';

const MODES = {
  whitney: {
    audio: require('@/assets/sounds/whitney_raw.wav'),
    beatTime: 9700,
    title: 'Whitney Houston',
    desc: 'The iconic beat drop!',
  },
  metronome: {
    audio: null,
    beatTime: 0,
    title: 'Metronome',
    desc: 'Hit the start of the next cycle!',
  }
};

const DRUM_HIT_AUDIO = require('@/assets/sounds/drum_hit.wav');
const METRONOME_TICK_AUDIO = require('@/assets/sounds/metronome_challenge.wav');

export function DrumChallengeSession({ session }: Props) {
  const players = session.players;
  const modeKey = (session.gameConfig?.drumMode as DrumMode) || 'whitney';
  const modeConfig = MODES[modeKey];
  const metronomeCycles = session.gameConfig?.metronomeCycles || 4;
  const metronomeRhythm = session.gameConfig?.metronomeRhythm || '4/4';

  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [lastDiff, setLastDiff] = useState<number | null>(null);
  const [tapped, setTapped] = useState(false);
  const [records, setRecords] = useState<PlayerRecord[]>(() =>
    players.map(p => ({ playerId: p.id, attempts: [] }))
  );

  const soundRef = useRef<Audio.Sound | null>(null);
  const drumRef = useRef<Audio.Sound | null>(null);
  const tickRef = useRef<Audio.Sound | null>(null);
  const tickPoolRef = useRef<Audio.Sound[]>([]);
  const playStartRef = useRef<number>(0);
  const diffRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<Phase>('ready');
  
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const player = players[playerIdx];
  const currentRecord = records[playerIdx];

  const drumScale = useSharedValue(1);
  const drumGlow = useSharedValue(0);
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    (async () => {
      try {
        // Ensure audio mode is configured before any sound loads
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        // Preload drum hit (player tap feedback)
        const { sound: drumSound } = await Audio.Sound.createAsync(DRUM_HIT_AUDIO, { shouldPlay: false });
        drumRef.current = drumSound;
        // Preload metronome tick
        const { sound: tickSound } = await Audio.Sound.createAsync(METRONOME_TICK_AUDIO, { shouldPlay: false });
        tickRef.current = tickSound;
      } catch (e) {
        console.warn('DrumChallenge: failed to init audio', e);
      }
    })();
    return () => {
      soundRef.current?.unloadAsync();
      drumRef.current?.unloadAsync();
      tickRef.current?.unloadAsync();
      tickPoolRef.current.forEach(s => s.unloadAsync().catch(() => {}));
      tickPoolRef.current = [];
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      metronomeTimersRef.current.forEach(t => clearTimeout(t));
      metronomeTimersRef.current = [];
      cancelAnimation(waveAnim);
    };
  }, []);

  const finishAttempt = useCallback((diff: number | null) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    metronomeTimersRef.current.forEach(t => clearTimeout(t));
    metronomeTimersRef.current = [];
    cancelAnimation(waveAnim);
    cancelAnimation(drumScale);
    drumScale.value = withTiming(1, { duration: 200 });

    try {
      if (soundRef.current) soundRef.current.stopAsync();
      if (tickRef.current) tickRef.current.stopAsync();
      tickPoolRef.current.forEach(s => s.stopAsync().catch(() => {}));
    } catch (e) {}

    setLastDiff(diff);
    setRecords(prev => {
      const next = prev.map(r => ({ ...r, attempts: [...r.attempts] }));
      next[playerIdx].attempts.push({ diffMs: diff });
      return next;
    });

    if (diff !== null) {
      const absDiff = Math.abs(diff);
      if (absDiff <= 50) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (absDiff <= 150) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setPhase('result');
  }, [playerIdx, drumScale, waveAnim]);

  const startListening = useCallback(async () => {
    setPhase('listening');
    setTapped(false);
    setLastDiff(null);
    diffRef.current = null;

    waveAnim.value = 0;
    waveAnim.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);

    drumScale.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 800 }), withTiming(1.0, { duration: 800 })), -1, false
    );

    if (modeKey === 'metronome') {
      // Clean up any previous tick pool
      tickPoolRef.current.forEach(s => s.unloadAsync().catch(() => {}));
      tickPoolRef.current = [];
      metronomeTimersRef.current.forEach(t => clearTimeout(t));
      metronomeTimersRef.current = [];

      const bpm = metronomeRhythm === 'fast' ? 160 : metronomeRhythm === '3/4' ? 100 : 120;
      const beatsPerCycle = metronomeRhythm === '3/4' ? 3 : 4;
      const msPerBeat = 60000 / bpm;
      
      const playCycles = metronomeCycles; // play selected cycles out loud
      const silentCycles = metronomeCycles; // then silence for same cycles
      
      const totalBeatsToPlay = playCycles * beatsPerCycle;
      const totalSilentBeats = silentCycles * beatsPerCycle;
      
      const targetTimeMs = (totalBeatsToPlay + totalSilentBeats) * msPerBeat;
      modeConfig.beatTime = targetTimeMs; // dynamically update
      
      // Pre-create all tick sounds (one per beat) for reliable playback
      const preloadTicks = async () => {
        const pool: Audio.Sound[] = [];
        for (let i = 0; i < totalBeatsToPlay; i++) {
          try {
            const isDownbeat = i % beatsPerCycle === 0;
            const { sound } = await Audio.Sound.createAsync(
              METRONOME_TICK_AUDIO,
              { shouldPlay: false, volume: isDownbeat ? 1.0 : 0.5 }
            );
            
            if (isDownbeat) {
              await sound.setRateAsync(1.5, false);
            }
            
            pool.push(sound);
          } catch (e) {
            console.warn('Failed to preload tick', i, e);
          }
        }
        tickPoolRef.current = pool;

        // Schedule all beats with precise timing
        playStartRef.current = performance.now();
        
        for (let i = 0; i < totalBeatsToPlay; i++) {
          const delay = i * msPerBeat;
          const timer = setTimeout(() => {
            if (phaseRef.current !== 'listening') return;
            try {
              pool[i]?.playAsync();
            } catch (e) {}
          }, delay);
          metronomeTimersRef.current.push(timer);
        }

        // After audible cycles end, set a timeout for auto-finish
        const finishDelay = targetTimeMs + 2000;
        const finishTimer = setTimeout(() => {
          if (phaseRef.current === 'listening') {
            finishAttempt(diffRef.current);
          }
        }, finishDelay);
        metronomeTimersRef.current.push(finishTimer);
      };

      preloadTicks();
    } else {
      try {
        if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }

        // Re-ensure audio mode is active before each playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        // Load the audio file first, then play explicitly
        const { sound } = await Audio.Sound.createAsync(modeConfig.audio, {
          shouldPlay: false,
          volume: 1.0,
        });
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            finishAttempt(diffRef.current);
          }
        });

        // Start playback and record the precise start time
        await sound.playAsync();
        playStartRef.current = performance.now();

        // Fallback timeout in case audio fails to fire completion
        timeoutRef.current = setTimeout(() => {
          finishAttempt(diffRef.current);
        }, 28000);
      } catch (e) {
        console.warn('DrumChallenge: audio playback failed', e);
        finishAttempt(null);
      }
    }
  }, [modeKey, modeConfig, metronomeCycles, metronomeRhythm, finishAttempt, waveAnim, drumScale]);

  const handleDrumTap = useCallback(async () => {
    if (phase !== 'listening' || tapped) return;
    setTapped(true);

    const tapTime = performance.now();
    let diff = 0;

    if (modeKey === 'metronome') {
      const elapsed = tapTime - playStartRef.current;
      // Compensate for hardware audio output latency (approx 50ms)
      diff = Math.round(elapsed - (modeConfig.beatTime + 50));
    } else {
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          const afterTime = performance.now();
          const latency = afterTime - tapTime;
          if (status.isLoaded) {
            // Approximate exact audio position at the moment of the tap
            const exactAudioPosition = status.positionMillis - (latency / 2);
            diff = Math.round(exactAudioPosition - modeConfig.beatTime);
          } else {
            const elapsed = tapTime - playStartRef.current;
            diff = Math.round(elapsed - modeConfig.beatTime);
          }
        } catch (e) {
          const elapsed = tapTime - playStartRef.current;
          diff = Math.round(elapsed - modeConfig.beatTime);
        }
      } else {
        const elapsed = tapTime - playStartRef.current;
        diff = Math.round(elapsed - modeConfig.beatTime);
      }
    }

    diffRef.current = diff;
    setLastDiff(diff); // Show 'Nice hit!' UI update instantly

    try {
      if (drumRef.current) {
        await drumRef.current.setPositionAsync(0);
        await drumRef.current.playAsync();
      }
    } catch {}

    cancelAnimation(drumScale);
    drumScale.value = withSequence(
      withSpring(1.3, { damping: 4, stiffness: 300 }),
      withSpring(1.0, { damping: 8 }),
    );
    drumGlow.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 600 }),
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Audio keeps playing to the end!
  }, [phase, tapped, modeConfig.beatTime, drumScale, drumGlow, modeKey]);

  const continueAfterAttempt = () => {
    const done = currentRecord?.attempts.length ?? 0;
    if (done >= ATTEMPTS_PER_PLAYER) setPhase('playerComplete');
    else { setAttemptIdx(done); startListening(); }
  };

  const goToNextPlayer = () => {
    if (playerIdx + 1 >= players.length) setPhase('results');
    else { setPlayerIdx(playerIdx + 1); setAttemptIdx(0); setPhase('ready'); }
  };

  const playAgain = () => {
    setRecords(players.map(p => ({ playerId: p.id, attempts: [] })));
    setPlayerIdx(0); setAttemptIdx(0); setLastDiff(null); setPhase('ready');
  };

  const drumAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: drumScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: drumGlow.value }));

  // ─── READY ───
  if (phase === 'ready') {
    const isFirst = playerIdx === 0;
    return (
      <View style={st.container}>
        <ScrollView contentContainerStyle={st.readyContent}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,46,147,0.15)' }]}>
            <Text style={{ fontSize: 56 }}>🥁</Text>
          </View>
          <Text style={st.eyebrow}>{isFirst ? 'DRUM CHALLENGE' : `PLAYER ${playerIdx + 1} OF ${players.length}`}</Text>
          <Text style={st.nameTitle} numberOfLines={2}>{player?.displayName ?? 'Player'}</Text>
          
          <Text style={[st.eyebrow, { color: '#FFD166', fontSize: 16 }]}>MODE: {modeConfig.title}</Text>

          <View style={st.rulesCard}>
            <RuleRow num={1} color="#FF2E93" text={modeKey === 'metronome' ? `A metronome plays ${metronomeCycles} cycles, then goes silent for ${metronomeCycles} cycles.` : "A music clip plays with a dramatic build-up."} />
            <RuleRow num={2} color="#FFD166" text={modeKey === 'metronome' ? "Keep counting the beats in your head during the silence." : "Listen carefully — after the pause, a drum beat will drop."} />
            <RuleRow num={3} color="#00E5FF" text={modeKey === 'metronome' ? "Tap EXACTLY when the next cycle (beat 1) should start!" : "Tap the drum at the EXACT moment you think the beat hits!"} />
            <RuleRow num={4} color={Colors.green} text="Your accuracy is measured in milliseconds. Closest to 0ms wins!" />
          </View>

          {!isFirst && (
            <View style={st.handoffCard}>
              <IconSymbol name="hand.raised.fill" size={22} color="#FF2E93" />
              <Text style={st.handoffTx}>Pass the phone to {player?.displayName}.</Text>
            </View>
          )}

          <Pressable style={[st.startBtn, { backgroundColor: '#FF2E93' }]} onPress={startListening}>
            <IconSymbol name="play.fill" size={18} color="#fff" />
            <Text style={st.startBtnTx}>Start Listening</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── LISTENING ───
  if (phase === 'listening') {
    return (
      <View style={st.listeningContainer}>
        <View style={st.attemptBadge}>
          <Text style={st.attemptBadgeTx}>Attempt {attemptIdx + 1} / {ATTEMPTS_PER_PLAYER}</Text>
        </View>

        <Text style={st.listenTitle}>Listen…</Text>
        <Text style={st.listenSub}>{modeConfig.title}</Text>

        <Pressable onPress={handleDrumTap} disabled={tapped}>
          <Animated.View style={[st.drumOuter, drumAnimStyle]}>
            <Animated.View style={[st.drumGlow, glowStyle]} />
            <View style={st.drumInner}>
              <Text style={{ fontSize: 130 }}>🥁</Text>
            </View>
          </Animated.View>
        </Pressable>

        <Text style={st.listenHint}>
          {tapped && lastDiff != null ? `🎯 ${Math.abs(lastDiff)}ms ${lastDiff < 0 ? 'early' : lastDiff > 0 ? 'late' : 'perfect'}!` : 'Wait for it...'}
        </Text>

        {tapped && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, paddingHorizontal: 32 }}>
            <Pressable style={[st.startBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1, marginTop: 0 }]} onPress={startListening}>
              <Text style={st.startBtnTx}>Restart</Text>
            </Pressable>
            <Pressable style={[st.startBtn, { backgroundColor: '#FF2E93', flex: 1, marginTop: 0 }]} onPress={() => finishAttempt(diffRef.current)}>
              <Text style={st.startBtnTx}>Result</Text>
            </Pressable>
          </View>
        )}

        <View style={st.waveRow}>
          {Array.from({ length: 20 }).map((_, i) => (
            <WaveBar key={i} index={i} anim={waveAnim} />
          ))}
        </View>
      </View>
    );
  }

  // ─── RESULT ───
  if (phase === 'result') {
    const absDiff = lastDiff != null ? Math.abs(lastDiff) : null;
    const isHit = lastDiff != null;
    const direction = lastDiff != null ? (lastDiff < 0 ? 'early' : lastDiff > 0 ? 'late' : 'perfect') : 'missed';

    return (
      <View style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: isHit ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.18)' }]}>
            {isHit ? (
              <IconSymbol name="checkmark.circle.fill" size={56} color={getAccuracyColor(absDiff!)} />
            ) : (
              <IconSymbol name="xmark.octagon.fill" size={56} color={Colors.red} />
            )}
          </View>

          {isHit ? (
            <>
              <Text style={st.resultBig}>{absDiff} ms</Text>
              <Text style={[st.resultDir, { color: getAccuracyColor(absDiff!) }]}>
                {direction === 'perfect' ? '🎯 PERFECT!' : direction === 'early' ? `⏪ ${Math.abs(lastDiff!)} ms early` : `⏩ ${Math.abs(lastDiff!)} ms late`}
              </Text>
              <Text style={st.sub}>{describeAccuracy(absDiff!)}</Text>
            </>
          ) : (
            <>
              <Text style={st.title}>Missed!</Text>
              <Text style={st.sub}>You didn{"'"}t tap in time.</Text>
            </>
          )}

          <AttemptDots attempts={currentRecord.attempts} total={ATTEMPTS_PER_PLAYER} />

          <Pressable style={[st.startBtn, { backgroundColor: '#007AFF' }]} onPress={continueAfterAttempt}>
            <Text style={st.startBtnTx}>
              {(currentRecord?.attempts.length ?? 0) >= ATTEMPTS_PER_PLAYER ? 'See Result' : 'Next Attempt'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── PLAYER COMPLETE ───
  if (phase === 'playerComplete') {
    const best = bestAbsDiff(currentRecord.attempts);
    const isLast = playerIdx + 1 >= players.length;
    return (
      <View style={st.container}>
        <View style={st.center}>
          <View style={[st.iconBox, { backgroundColor: 'rgba(255,204,0,0.18)' }]}>
            <IconSymbol name="trophy.fill" size={48} color={Colors.yellow} />
          </View>
          <Text style={st.title}>{player?.displayName}</Text>
          <Text style={st.sub}>Best accuracy</Text>
          <Text style={[st.title, { color: '#FF2E93', fontSize: 44, marginTop: 4 }]}>
            {best != null ? `${best} ms` : '—'}
          </Text>

          <View style={st.attemptList}>
            {currentRecord.attempts.map((a, i) => (
              <View key={i} style={st.attemptRow}>
                <Text style={st.attemptIdx}>#{i + 1}</Text>
                <Text style={[st.attemptVal, a.diffMs == null ? { color: Colors.red } : null]}>
                  {a.diffMs == null ? 'Missed' : `${a.diffMs > 0 ? '+' : ''}${a.diffMs} ms`}
                </Text>
              </View>
            ))}
          </View>

          <Pressable style={[st.startBtn, { backgroundColor: '#FF2E93' }]} onPress={goToNextPlayer}>
            <Text style={st.startBtnTx}>{isLast ? 'See Final Rankings' : 'Next Player'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── RESULTS ───
  const entries: RankEntry[] = [...records]
    .map(r => {
      const best = bestAbsDiff(r.attempts);
      const p = players.find(pp => pp.id === r.playerId);
      return { record: r, best, name: p?.displayName ?? 'Player' };
    })
    .sort((a, b) => {
      if (a.best == null && b.best == null) return 0;
      if (a.best == null) return 1;
      if (b.best == null) return -1;
      return a.best - b.best;
    })
    .map((row): RankEntry => ({
      id: row.record.playerId,
      name: row.name,
      primary: row.best == null ? '—' : `${row.best} ms`,
      secondary: row.record.attempts.map(a => a.diffMs == null ? 'Miss' : `${a.diffMs > 0 ? '+' : ''}${a.diffMs}`).join(' · '),
    }));

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Your Result'}
          subtitle="Closest to the beat wins"
          onPlayAgain={playAgain}
          shareGameName="Drum Challenge"
        />
      </ScrollView>
    </View>
  );
}

// ─── Helpers ───
function bestAbsDiff(attempts: Attempt[]): number | null {
  const valid = attempts.map(a => a.diffMs).filter((m): m is number => m != null);
  if (valid.length === 0) return null;
  return Math.min(...valid.map(Math.abs));
}

function getAccuracyColor(absDiff: number): string {
  if (absDiff <= 30) return '#FFD700';
  if (absDiff <= 80) return Colors.green;
  if (absDiff <= 150) return Colors.cyan;
  if (absDiff <= 300) return Colors.orange;
  return Colors.red;
}

function describeAccuracy(absDiff: number): string {
  if (absDiff <= 15) return '🔥 Inhuman precision!';
  if (absDiff <= 30) return '🎯 Almost perfect!';
  if (absDiff <= 80) return '🎶 Great rhythm!';
  if (absDiff <= 150) return '👏 Solid timing.';
  if (absDiff <= 300) return '😬 Close-ish…';
  return '💀 Way off!';
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

function AttemptDots({ attempts, total }: { attempts: Attempt[]; total: number }) {
  return (
    <View style={st.dotsRow}>
      {Array.from({ length: total }).map((_, i) => {
        const a = attempts[i];
        const filled = !!a;
        const missed = a?.diffMs == null;
        const bg = !filled ? 'rgba(255,255,255,0.1)' : missed ? Colors.red : getAccuracyColor(Math.abs(a.diffMs!));
        return <View key={i} style={[st.dot, { backgroundColor: bg }]} />;
      })}
    </View>
  );
}

function WaveBar({ index, anim }: { index: number; anim: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const phase = (anim.value * 2 * Math.PI) + (index * 0.3);
    const h = 12 + Math.sin(phase) * 16;
    return { height: Math.max(4, h) };
  });
  return <Animated.View style={[st.waveBar, style]} />;
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  iconBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '900',
    letterSpacing: 2.4, textAlign: 'center', marginTop: 4,
  },
  nameTitle: { color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' },

  rulesCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 12, marginTop: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ruleNumTx: { fontSize: 14, fontWeight: 'bold' },
  ruleTx: { color: 'rgba(255,255,255,0.85)', fontSize: 14, flex: 1, lineHeight: 19 },

  handoffCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,46,147,0.10)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,46,147,0.25)', marginTop: 8,
  },
  handoffTx: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 19, fontWeight: '600' },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 16, width: '100%', marginTop: 18,
  },
  startBtnTx: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Listening phase
  listeningContainer: {
    flex: 1, backgroundColor: '#0A0015', alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  listenTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  listenSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  listenHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', marginTop: 12 },

  drumOuter: { width: 280, height: 280, borderRadius: 140, alignItems: 'center', justifyContent: 'center' },
  drumGlow: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,46,147,0.3)',
  },
  drumInner: {
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,46,147,0.12)', borderWidth: 3, borderColor: 'rgba(255,46,147,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  attemptBadge: {
    position: 'absolute', top: 18, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  attemptBadgeTx: { color: '#fff', fontSize: 13, fontWeight: '700' },

  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginTop: 20 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#FF2E93' },

  // Result
  resultBig: { color: '#fff', fontSize: 52, fontWeight: '900', fontVariant: ['tabular-nums'] },
  resultDir: { fontSize: 17, fontWeight: '700' },

  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },

  attemptList: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 12, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginTop: 16,
  },
  attemptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  attemptIdx: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  attemptVal: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
});
