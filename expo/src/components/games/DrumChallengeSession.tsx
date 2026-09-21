import { useGameActivity, GAME_UI } from './GameActivity';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, withRepeat, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Audio } from '@/src/services/GameAudio';
import { Colors } from '@/src/theme/Colors';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import * as Haptics from '@/src/utils/safeHaptics';
import { PhaseTransition } from './PhaseTransition';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { isWeb } from '@/src/utils/platform';
import { playWebTick, playWebDrumHit } from '@/src/utils/browserMediaAdapter';
import { BrowserRecordingPlayback } from '@/src/utils/browserRecordingPlayback';
import { Asset } from 'expo-asset';
import { DrumIllustration } from './GameIllustrations';
import { metronomePlan, metronomeError } from '@/src/utils/metronomeChallenge';

interface Props { session: GameSession; }

type Phase = 'ready' | 'listening' | 'result' | 'playerComplete' | 'results';

const ATTEMPTS_PER_PLAYER = 3;

interface Attempt { diffMs: number | null; } // null = missed / didn't tap
interface PlayerRecord { playerId: string; attempts: Attempt[]; }

type DrumMode = 'whitney' | 'metronome';

const MODES = {
  whitney: {
    audio: require('@/assets/sounds/music_drop.wav'),
    beatTime: 9700,
    title: 'Music Drop',
    desc: 'Catch the beat after the pause!',
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
  const registerSkip = useRegisterSkip();
  const modeKey: DrumMode = (session.gameConfig?.drumMode === 'metronome') ? 'metronome' : 'whitney';
  const modeConfig = MODES[modeKey];
  const metronomeRhythm = session.gameConfig?.metronomeRhythm || '4/4';

  const [phase, setPhase] = useState<Phase>('ready');
  const [playerIdx, setPlayerIdx] = useState(0);
  useGameActivity(session.players[playerIdx]?.displayName, phase);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [lastDiff, setLastDiff] = useState<number | null>(null);
  const [tapped, setTapped] = useState(false);
  const tapAccepted = useRef(false);
  const [silent, setSilent] = useState(false);
  const plan = metronomePlan(metronomeRhythm);
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
  const webPlayback = useRef(new BrowserRecordingPlayback());
  const attemptGeneration = useRef(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const player = players[playerIdx];
  const currentRecord = records[playerIdx];

  const drumScale = useSharedValue(1);
  const drumGlow = useSharedValue(0);
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    let disposed = false;
    if (!isWeb) {
      (async () => {
        try {
          // Ensure audio mode is configured before any sound loads
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          if (disposed) return;
          // Preload drum hit (player tap feedback)
          const { sound: drumSound } = await Audio.Sound.createAsync(DRUM_HIT_AUDIO, { shouldPlay: false });
          if (disposed) { await drumSound.unloadAsync(); return; }
          drumRef.current = drumSound;
          // Preload metronome tick
          const { sound: tickSound } = await Audio.Sound.createAsync(METRONOME_TICK_AUDIO, { shouldPlay: false });
          if (disposed) { await tickSound.unloadAsync(); return; }
          tickRef.current = tickSound;
        } catch (e) {
          console.warn('DrumChallenge: failed to init audio', e);
        }
      })();
    }
    return () => {
      disposed = true;
      phaseRef.current = 'ready';
      attemptGeneration.current++;
      webPlayback.current.clear();
      if (!isWeb) {
        void soundRef.current?.unloadAsync().catch(() => {});
        void drumRef.current?.unloadAsync().catch(() => {});
        void tickRef.current?.unloadAsync().catch(() => {});
        tickPoolRef.current.forEach(s => s.unloadAsync().catch(() => {}));
        tickPoolRef.current = [];
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      metronomeTimersRef.current.forEach(t => clearTimeout(t));
      metronomeTimersRef.current = [];
      cancelAnimation(waveAnim);
      cancelAnimation(drumScale);
      cancelAnimation(drumGlow);
    };
  }, []);

  // Register skip handler during 'listening' and 'result' phases
  useEffect(() => {
    if (phase === 'listening' || phase === 'result') {
      registerSkip(() => {
        attemptGeneration.current++;
        webPlayback.current.stop();
        phaseRef.current = 'ready';
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        metronomeTimersRef.current.forEach(t => clearTimeout(t));
        metronomeTimersRef.current = [];
        cancelAnimation(waveAnim);
        cancelAnimation(drumScale);
        if (!isWeb) {
          try {
            if (soundRef.current) soundRef.current.stopAsync();
            if (tickRef.current) tickRef.current.stopAsync();
            tickPoolRef.current.forEach(s => s.stopAsync().catch(() => {}));
          } catch (e) {}
        }
        const isLast = playerIdx + 1 >= players.length;
        if (isLast) {
          setPhase('results');
        } else {
          setPlayerIdx(playerIdx + 1);
          setAttemptIdx(0);
          setPhase('ready');
        }
      }, player?.displayName);
    } else {
      registerSkip(null);
    }
    return () => registerSkip(null);
  }, [phase, playerIdx]);

  const finishAttempt = useCallback((diff: number | null) => {
    if (phaseRef.current !== 'listening') return;
    phaseRef.current = 'result';
    attemptGeneration.current++;
    webPlayback.current.stop();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    metronomeTimersRef.current.forEach(t => clearTimeout(t));
    metronomeTimersRef.current = [];
    cancelAnimation(waveAnim);
    cancelAnimation(drumScale);
    drumScale.value = withTiming(1, { duration: 200 });

    if (!isWeb) {
      try {
        if (soundRef.current) soundRef.current.stopAsync();
        if (tickRef.current) tickRef.current.stopAsync();
        tickPoolRef.current.forEach(s => s.stopAsync().catch(() => {}));
      } catch (e) {}
    }

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
    const generation = ++attemptGeneration.current;
    const finishCurrentAttempt = (diff: number | null) => {
      if (generation === attemptGeneration.current) finishAttempt(diff);
    };
    webPlayback.current.stop();
    setAudioError(null);
    playStartRef.current = Number.POSITIVE_INFINITY;
    phaseRef.current = 'listening';
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPhase('listening');
    setTapped(false);
    tapAccepted.current = false;
    setSilent(false);
    setLastDiff(null);
    diffRef.current = null;

    waveAnim.value = 0;
    waveAnim.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);

    drumScale.value = 1;

    if (modeKey === 'metronome') {
      const schedule = metronomePlan(metronomeRhythm);
      metronomeTimersRef.current.forEach(clearTimeout);
      metronomeTimersRef.current = [];
      tickPoolRef.current.forEach(sound => sound.unloadAsync().catch(() => {}));
      tickPoolRef.current = [];
      try {
        if (!isWeb) {
          // Preload before starting the clock; missing ticks must never silently count as a trial.
          for (const tick of schedule.ticks) {
            const { sound } = await Audio.Sound.createAsync(METRONOME_TICK_AUDIO, { shouldPlay: false, volume: tick.accent ? 1 : 0.45 });
            if (generation !== attemptGeneration.current) { await sound.unloadAsync(); return; }
            tickPoolRef.current.push(sound);
            if (tick.accent) await sound.setRateAsync(1.5, false);
          }
        }
        if (generation !== attemptGeneration.current) return;
        const failAudio = () => {
          if (generation !== attemptGeneration.current) return;
          attemptGeneration.current++;
          metronomeTimersRef.current.forEach(clearTimeout);
          tickPoolRef.current.forEach(sound => sound.stopAsync().catch(() => {}));
          setAudioError('Sound could not start. Tap Start Listening to retry.');
          phaseRef.current = 'ready';
          setPhase('ready');
        };
        playStartRef.current = performance.now();
        schedule.ticks.forEach((tick, index) => {
          const play = () => {
            if (generation !== attemptGeneration.current || phaseRef.current !== 'listening') return;
            if (isWeb) playWebTick(tick.accent);
            else tickPoolRef.current[index]?.playAsync().catch(failAudio);
          };
          if (index === 0) play();
          else metronomeTimersRef.current.push(setTimeout(play, tick.atMs));
        });
        metronomeTimersRef.current.push(setTimeout(() => {
          if (generation !== attemptGeneration.current) return;
          cancelAnimation(waveAnim);
          setSilent(true);
        }, schedule.audibleMs));
        metronomeTimersRef.current.push(setTimeout(() => finishCurrentAttempt(null), schedule.targetMs + 2000));
      } catch {
        if (generation !== attemptGeneration.current) return;
        tickPoolRef.current.forEach(sound => sound.unloadAsync().catch(() => {}));
        tickPoolRef.current = [];
        setAudioError('Sound could not load. Tap Start Listening to retry.');
        phaseRef.current = 'ready';
        setPhase('ready');
      }
    } else {
      try {
        if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }

        if (isWeb) {
          const uri = Asset.fromModule(modeConfig.audio!).uri;
          const started = await webPlayback.current.play(uri, 1, () => finishCurrentAttempt(diffRef.current));
          if (!started || generation !== attemptGeneration.current) return;
          playStartRef.current = performance.now();
          timeoutRef.current = setTimeout(() => {
            finishCurrentAttempt(diffRef.current);
          }, 28000);
          return;
        }

        // Re-ensure audio mode is active before each playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // Load the audio file first, then play explicitly
        const { sound } = await Audio.Sound.createAsync(modeConfig.audio, {
          shouldPlay: false,
          volume: 1.0,
        });
        if (generation !== attemptGeneration.current) { await sound.unloadAsync(); return; }
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            finishCurrentAttempt(diffRef.current);
          }
        });

        // Start playback and record the precise start time
        await sound.playAsync();
        if (generation !== attemptGeneration.current) return;
        playStartRef.current = performance.now();

        // Fallback timeout in case audio fails to fire completion
        timeoutRef.current = setTimeout(() => {
          finishCurrentAttempt(diffRef.current);
        }, 28000);
      } catch (e) {
        console.warn('DrumChallenge: audio playback failed', e);
        if (generation !== attemptGeneration.current) return;
        webPlayback.current.stop();
        setAudioError('Sound could not start. Check your volume, then tap Ready to retry.');
        phaseRef.current = 'ready';
        setPhase('ready');
      }
    }
  }, [modeKey, modeConfig, metronomeRhythm, finishAttempt, waveAnim, drumScale]);

  const handleDrumTap = useCallback(async () => {
    if (phase !== 'listening' || tapped || tapAccepted.current || !Number.isFinite(playStartRef.current)) return;

    const tapTime = performance.now();
    let diff = 0;

    if (modeKey === 'metronome') {
      const elapsed = tapTime - playStartRef.current;
      const schedule = metronomePlan(metronomeRhythm);
      if (phaseRef.current !== 'listening' || elapsed < schedule.audibleMs) return;
      diff = metronomeError(elapsed, schedule);
      tapAccepted.current = true;
      // Finish synchronously before any awaited audio: double taps cannot submit twice.
      setTapped(true);
      finishAttempt(diff);
      if (isWeb) playWebDrumHit();
      else if (drumRef.current) {
        try { await drumRef.current.setPositionAsync(0); await drumRef.current.playAsync(); } catch {}
      }
      return;
    }

    setTapped(true);

    tapAccepted.current = true;
    // Web does not load the native drumRef. Play inside the tap gesture.
    if (isWeb) playWebDrumHit();

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
  }, [phase, tapped, modeConfig.beatTime, drumScale, drumGlow, modeKey, metronomeRhythm, finishAttempt]);

  const continueAfterAttempt = () => {
    const done = currentRecord?.attempts.length ?? 0;
    if (done >= ATTEMPTS_PER_PLAYER) {
      const isLast = playerIdx + 1 >= players.length;
      if (isLast) {
        setPhase('results');
      } else {
        setPhase('playerComplete');
      }
    } else {
      setAttemptIdx(done);
      startListening();
    }
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

  if (phase === 'ready') {
    return (
      <PhaseTransition phaseKey={`ready-${playerIdx}`} style={{ flex: 1 }}>
        <GamePassPhoneView
          playerName={player?.displayName ?? 'Player'}
          title={players.length > 1 && playerIdx > 0 ? "Pass the phone to" : "Get ready"}
          subtitle={audioError || `Drum Challenge · Mode: ${modeConfig.title} · ${ATTEMPTS_PER_PLAYER} attempts`}
          accentColor="#FF2E93"
          buttonTitle="Start Listening"
          onReady={startListening}
          onSkip={() => {
            const isLast = playerIdx + 1 >= players.length;
            if (isLast) {
              setPhase('results');
            } else {
              setPlayerIdx(playerIdx + 1);
              setAttemptIdx(0);
              setPhase('ready');
            }
          }}
        />
      </PhaseTransition>
    );
  }

  // ─── LISTENING ───
  if (phase === 'listening') {
    return (
      <PhaseTransition phaseKey={phase} style={st.listeningContainer}>
        <View style={st.attemptBadge}>
          <Text style={st.attemptBadgeTx}>Attempt {attemptIdx + 1} / {ATTEMPTS_PER_PLAYER}</Text>
        </View>

        <Text style={st.listenTitle}>{modeKey === 'metronome' && silent ? 'Keep counting…' : 'Listen…'}</Text>
        <Text style={st.listenSub}>{modeKey === 'metronome' ? plan.rhythm.title : modeConfig.title}</Text>

        <Pressable testID="drum-challenge-tap-btn" accessibilityRole="button" onPress={handleDrumTap} disabled={tapped || (modeKey === 'metronome' && !silent)}>
          <Animated.View style={[st.drumOuter, drumAnimStyle]}>
            <Animated.View style={[st.drumGlow, glowStyle]} />
            <View style={st.drumInner}>
              <DrumIllustration />
            </View>
          </Animated.View>
        </Pressable>

        <Text style={st.listenHint}>
          {modeKey === 'metronome'
            ? (silent ? 'Count 4 silent bars, then tap once' : 'Listen to 4 bars')
            : tapped && lastDiff != null 
              ? `🎯 ${Math.abs(lastDiff)}ms ${lastDiff < 0 ? 'early' : lastDiff > 0 ? 'late' : 'perfect'}!` 
              : 'Tap the drum when the beat lands'}
        </Text>

        {tapped && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, paddingHorizontal: 32 }}>
            <Pressable style={[st.startBtn, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1, marginTop: 0 }]} onPress={startListening}>
              <Text style={st.startBtnTx}>Restart</Text>
            </Pressable>
            <Pressable testID="drum-challenge-result-btn" accessibilityRole="button" style={[st.startBtn, { backgroundColor: '#FF2E93', flex: 1, marginTop: 0 }]} onPress={() => finishAttempt(diffRef.current)}>
              <Text style={st.startBtnTx}>Result</Text>
            </Pressable>
          </View>
        )}

        {!(modeKey === 'metronome' && silent) && <View style={st.waveRow}>
          {Array.from({ length: 20 }).map((_, i) => (
            <WaveBar key={i} index={i} anim={waveAnim} />
          ))}
        </View>}

      </PhaseTransition>
    );
  }

  // ─── RESULT ───
  if (phase === 'result') {
    const absDiff = lastDiff != null ? Math.abs(lastDiff) : null;
    const isHit = lastDiff != null;
    const direction = lastDiff != null ? (lastDiff < 0 ? 'early' : lastDiff > 0 ? 'late' : 'perfect') : 'missed';

    return (
      <PhaseTransition phaseKey={phase} style={st.container}>
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

          <Pressable testID="drum-challenge-next-attempt" accessibilityRole="button" style={[st.startBtn, { backgroundColor: '#007AFF' }]} onPress={continueAfterAttempt}>
            <Text style={st.startBtnTx}>
              {(currentRecord?.attempts.length ?? 0) >= ATTEMPTS_PER_PLAYER ? 'See Result' : 'Next Attempt'}
            </Text>
          </Pressable>
        </View>
      </PhaseTransition>
    );
  }

  // ─── PLAYER COMPLETE ───
  if (phase === 'playerComplete') {
    const best = bestAbsDiff(currentRecord.attempts);
    const isLast = playerIdx + 1 >= players.length;
    return (
      <GamePlayerCompleteView
        prevPlayerName={player?.displayName}
        nextPlayerName={isLast ? '' : (players[playerIdx + 1]?.displayName ?? 'Next Player')}
        prevResultLine={best != null ? `Best: ${best}ms · ${ATTEMPTS_PER_PLAYER} attempts` : `${ATTEMPTS_PER_PLAYER} attempts done`}
        onReady={goToNextPlayer}
        accentColor="#FF2E93"
      />
    );
  }

  // ─── RESULTS ───
  const entries: RankEntry[] = [...records]
    .map(r => {
      const best = bestAbsDiff(r.attempts);
      const p = players.find(pp => pp.id === r.playerId);
      const isSkipped = best == null;
      return { record: r, best, isSkipped, name: p?.displayName ?? 'Player' };
    })
    .sort((a, b) => {
      if (a.isSkipped !== b.isSkipped) return a.isSkipped ? 1 : -1;
      if (a.best == null && b.best == null) return 0;
      if (a.best == null) return 1;
      if (b.best == null) return -1;
      return a.best - b.best;
    })
    .map((row): RankEntry => ({
      id: row.record.playerId,
      name: row.name,
      isSkipped: row.isSkipped,
      primary: row.isSkipped ? 'Skipped' : `${row.best} ms`,
      secondary: row.isSkipped ? 'Did not play' : row.record.attempts.map(a => a.diffMs == null ? 'Miss' : `${a.diffMs > 0 ? '+' : ''}${a.diffMs}`).join(' · '),
    }));

  return (
    <PhaseTransition phaseKey="results" style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ResultsScoreboard
          entries={entries}
          title={players.length > 1 ? 'Final Rankings' : 'Your Result'}
          subtitle="Closest to the beat wins"
          onPlayAgain={playAgain}
          shareGameName="Drum Challenge"
        />
      </ScrollView>
    </PhaseTransition>
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
  readyContent: { padding: 20, paddingBottom: 60, alignItems: 'center', gap: 14, maxWidth: 540, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, maxWidth: 540, width: '100%', alignSelf: 'center' },
  iconBox: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 36, fontFamily: 'Viral-Black', textAlign: 'center' },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Viral-Black',
    letterSpacing: 2.4, textAlign: 'center', marginTop: 4,
  },
  nameTitle: { color: '#fff', fontSize: 40, fontFamily: 'Viral-Black', textAlign: 'center', paddingHorizontal: 8 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'center', fontWeight: '500' },

  rulesCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 12, marginTop: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ruleNumTx: { fontSize: 16, fontFamily: 'Viral-Black' },
  ruleTx: { color: 'rgba(255,255,255,0.85)', fontSize: 15, flex: 1, lineHeight: 22 },

  handoffCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,46,147,0.10)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,46,147,0.25)', marginTop: 8,
  },
  handoffTx: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 20, lineHeight: 28, fontWeight: '700' },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 18, paddingHorizontal: 28,
     width: '100%', maxWidth: 540, alignSelf: 'center', marginTop: 18, minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  startBtnTx: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Listening phase
  listeningContainer: {
    flex: 1, backgroundColor: '#0A0015', alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  listenTitle: { color: '#fff', fontSize: 40, fontFamily: 'Viral-Black', letterSpacing: 0.5 },
  listenSub: { color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: '700' },
  listenHint: { color: 'rgba(255,255,255,0.4)', fontSize: 22, fontWeight: '700', marginTop: 12 },

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
  attemptBadgeTx: { color: '#fff', fontSize: 16, fontWeight: '700' },

  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginTop: 20 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#FF2E93' },

  // Result
  resultBig: { color: '#fff', fontSize: 64, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
  resultDir: { fontSize: 22, fontFamily: 'Viral-Black' },

  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },

  attemptList: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 12, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginTop: 16,
  },
  attemptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  attemptIdx: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: '700' },
  attemptVal: { color: '#fff', fontSize: 20, fontFamily: 'Viral-Black', fontVariant: ['tabular-nums'] },
});
