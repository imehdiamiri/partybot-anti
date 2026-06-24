import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, TouchableOpacity, GestureResponderEvent, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { AudioManager } from '@/src/services/AudioManager';
import { GamePassPhoneView } from './SharedGameComponents';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform } from 'react-native';

let FileSystem: any = null;
let FileSystemEncoding: any = { Base64: 'base64' };

if (Platform.OS !== 'web') {
  try {
    FileSystem = require('expo-file-system/legacy');
    if (FileSystem.EncodingType) {
      FileSystemEncoding = FileSystem.EncodingType;
    }
  } catch {
    try {
      FileSystem = require('expo-file-system');
      if (FileSystem.EncodingType) {
        FileSystemEncoding = FileSystem.EncodingType;
      }
    } catch {}
  }
}
import { Audio } from 'expo-av';
import { useSettingsStore } from '@/src/store/useSettingsStore';

interface Props { session: GameSession; }
type Phase = 'ready' | 'memorize' | 'recreate' | 'roundResult' | 'results';

interface PlayerRoundResult {
  playerId: string;
  roundIndex: number;
  guessFrequency: number;
  targetFrequency: number;
  score: number;
}

// Custom platform-safe Base64 encoder for ArrayBuffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(buffer);
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    const enc3 = i + 1 < len ? (((b2 & 15) << 2) | (b3 >> 6)) : 64;
    const enc4 = i + 2 < len ? (b3 & 63) : 64;
    
    base64 += chars.charAt(enc1) + chars.charAt(enc2) + 
              (enc3 === 64 ? '=' : chars.charAt(enc3)) + 
              (enc4 === 64 ? '=' : chars.charAt(enc4));
  }
  return base64;
}

// Generate a temporary WAV file containing a sine wave of the given frequency
async function generateToneWav(frequency: number, durationSeconds: number): Promise<string> {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit PCM (2 bytes per sample)
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Header
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM Format
  view.setUint16(22, 1, true); // Channels (Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave with fade-in/out envelope to prevent clicks
  const amplitude = 32767 * 0.45;
  const fadeLen = Math.min(Math.floor(sampleRate * 0.02), numSamples / 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let envelope = 1.0;
    if (i < fadeLen) envelope = i / fadeLen;
    else if (i > numSamples - fadeLen) envelope = (numSamples - i) / fadeLen;
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope;
    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * amplitude)));
    view.setInt16(44 + i * 2, val, true);
  }

  if (!FileSystem) return '';

  const base64 = arrayBufferToBase64(buffer);
  const filename = `tone_${Math.round(frequency)}.wav`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystemEncoding.Base64,
  });

  return fileUri;
}

// Compute frequency matching score based on octave distance (logarithmic scale)
function calculateAuditoryScore(target: number, guess: number): number {
  const targetRounded = Math.round(target);
  const guessRounded = Math.round(guess);
  if (targetRounded === guessRounded) {
    return 10.00;
  }

  // Compute difference in octaves: diff = abs(log2(target / guess))
  const diff = Math.abs(Math.log2(targetRounded / guessRounded));
  
  // Define maximum tolerable difference as 1.2 octaves (about a 10th interval)
  const maxDiff = 1.2;
  const normDiff = Math.min(1.0, diff / maxDiff);
  
  // Power factor of 1.2 to give slightly better rewards for closer matches
  const rawScore = 10 * Math.pow(1 - normDiff, 1.2);
  return Math.max(0, Math.round(rawScore * 100) / 100);
}

const FREQ_MIN = 200;
const FREQ_MAX = 1000;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SLIDER_HEIGHT = Math.min(SCREEN_HEIGHT * 0.52, 430);

// Map a frequency to a vertical position (bottom = low, top = high)
function freqToPosition(freq: number): number {
  const pct = (freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
  return (1 - pct) * SLIDER_HEIGHT;
}

// Map a vertical position to a frequency
function positionToFreq(pos: number): number {
  const pct = 1 - pos / SLIDER_HEIGHT;
  return FREQ_MIN + pct * (FREQ_MAX - FREQ_MIN);
}

// Sound Wave Bar helper component for premium animated audio visualizer
function SoundWaveBar({ active, height, delay, color = '#FF2D55' }: { active: boolean; height: number; delay: number; color?: string }) {
  const scale = useSharedValue(0.2);
  
  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 350 + (delay % 180), easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 350 + (delay % 180), easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(0.2);
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scaleY: scale.value }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: 5,
          height: height,
          backgroundColor: color,
          borderRadius: 2.5,
          marginHorizontal: 3,
        },
        animatedStyle,
      ]}
    />
  );
}

export function SoundMatchSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();
  const maxRounds = session.maxRounds || 5;

  // Generate target frequencies for all rounds
  const [targetFrequencies] = useState<number[]>(() => {
    return Array.from({ length: maxRounds }, () => {
      const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
      return scale[Math.floor(Math.random() * scale.length)];
    });
  });

  const [phase, setPhase] = useState<Phase>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [playerIdx, setPlayerIdx] = useState(0);
  
  const [currentGuessFreq, setCurrentGuessFreq] = useState(440);
  const [guesses, setGuesses] = useState<PlayerRoundResult[]>([]);
  
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingGuess, setIsPlayingGuess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const activeSoundRef = useRef<Audio.Sound | null>(null);
  const livePlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlayedFreqRef = useRef<number>(0);
  const activePlayer = players[playerIdx];
  const activeTargetFreq = targetFrequencies[roundIdx];

  const pulseScale = useSharedValue(1);

  // Score feedback animations & state
  const badgeScale = useSharedValue(0);
  const badgeShake = useSharedValue(0);

  const lastResult = guesses[guesses.length - 1];

  const feedbackConfig = useMemo(() => {
    if (!lastResult) return null;
    const s = lastResult.score;
    if (s === 10) return { text: '✨ PERFECT 10! ✨', color: '#FFD700', icon: 'crown.fill' };
    if (s >= 9.0) return { text: '🔥 EXCELLENT 🔥', color: '#2ECC71', icon: 'sparkles' };
    if (s >= 7.0) return { text: '👍 GOOD JOB 👍', color: '#3498DB', icon: 'checkmark.circle.fill' };
    if (s < 5.0) return { text: '😢 TRY AGAIN 😢', color: '#E74C3C', icon: 'exclamationmark.triangle.fill' };
    return { text: 'OKAY', color: '#F1C40F', icon: 'circle' };
  }, [lastResult]);

  useEffect(() => {
    if (phase === 'roundResult' && lastResult) {
      const s = lastResult.score;
      badgeScale.value = 0;
      badgeShake.value = 0;

      if (s < 5.0) {
        badgeScale.value = withTiming(1, { duration: 250 });
        badgeShake.value = withSequence(
          withTiming(-12, { duration: 60 }),
          withTiming(12, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(-4, { duration: 60 }),
          withTiming(4, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
      } else if (s === 10) {
        badgeScale.value = withSequence(
          withTiming(1.4, { duration: 250, easing: Easing.out(Easing.back(1.5)) }),
          withTiming(1.0, { duration: 150 })
        );
      } else {
        badgeScale.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1.0, { duration: 100 })
        );
      }
    }
  }, [phase, lastResult]);

  const animatedBadgeStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: badgeScale.value },
        { translateX: badgeShake.value }
      ]
    };
  });

  // Pulse animation for playing sound
  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: (isPlayingTarget || isPlayingGuess) ? 0.35 : 0,
    };
  });

  useEffect(() => {
    if (isPlayingTarget || isPlayingGuess) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 450, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 450, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1.0);
    }
  }, [isPlayingTarget, isPlayingGuess]);

  const stopActiveSound = async () => {
    if (activeSoundRef.current) {
      try {
        await activeSoundRef.current.stopAsync();
        await activeSoundRef.current.unloadAsync();
      } catch (e) {
        // ignore
      }
      activeSoundRef.current = null;
    }
    setIsPlayingTarget(false);
    setIsPlayingGuess(false);
  };

  const playFrequency = async (freq: number, duration: number, isTarget: boolean) => {
    await stopActiveSound();
    
    if (!useSettingsStore.getState().isSoundEnabled) {
      if (isTarget) {
        setIsPlayingTarget(true);
        setTimeout(() => setIsPlayingTarget(false), duration * 1000);
      } else {
        setIsPlayingGuess(true);
        setTimeout(() => setIsPlayingGuess(false), duration * 1000);
      }
      return;
    }

    try {
      if (isTarget) setIsPlayingTarget(true);
      else setIsPlayingGuess(true);

      const fileUri = await generateToneWav(freq, duration);
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      activeSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync();
          if (activeSoundRef.current === sound) {
            activeSoundRef.current = null;
          }
          setIsPlayingTarget(false);
          setIsPlayingGuess(false);
        }
      });
    } catch (e) {
      console.warn('Failed to play tone', e);
      setIsPlayingTarget(false);
      setIsPlayingGuess(false);
    }
  };

  // Live play: debounced auto-play while dragging the slider
  const schedulePlayLive = useCallback((freq: number) => {
    if (livePlayTimerRef.current) clearTimeout(livePlayTimerRef.current);
    
    // Only replay if frequency changed enough (> 8 Hz difference)
    const diff = Math.abs(freq - lastPlayedFreqRef.current);
    if (diff < 8) return;

    livePlayTimerRef.current = setTimeout(() => {
      lastPlayedFreqRef.current = freq;
      playFrequency(freq, 0.6, false);
    }, 80); // 80ms debounce — responsive but avoids overlapping
  }, []);

  // Turn skipping logic
  useEffect(() => {
    if (phase === 'memorize' || phase === 'recreate') {
      registerSkip(async () => {
        await stopActiveSound();

        const newResult: PlayerRoundResult = {
          playerId: activePlayer.id,
          roundIndex: roundIdx,
          guessFrequency: 200,
          targetFrequency: activeTargetFreq,
          score: 0,
        };

        setGuesses(prev => [...prev, newResult]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        AudioManager.play('fail');

        const isLastPlayer = playerIdx + 1 >= players.length;
        if (isLastPlayer) {
          const isLastRound = roundIdx + 1 >= maxRounds;
          if (isLastRound) {
            setPhase('results');
          } else {
            setPlayerIdx(0);
            setRoundIdx(r => r + 1);
            setPhase('ready');
          }
        } else {
          setPlayerIdx(p => p + 1);
          setPhase('ready');
        }
      }, activePlayer?.displayName);
    } else {
      registerSkip(null);
    }
    return () => {
      registerSkip(null);
    };
  }, [phase, playerIdx, roundIdx, activePlayer, activeTargetFreq]);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      stopActiveSound();
      if (livePlayTimerRef.current) clearTimeout(livePlayTimerRef.current);
    };
  }, []);

  const handleStartMatch = async () => {
    await stopActiveSound();
    setPhase('recreate');
    setCurrentGuessFreq(440);
    lastPlayedFreqRef.current = 0;
  };

  const handleSubmitGuess = async () => {
    await stopActiveSound();
    if (livePlayTimerRef.current) clearTimeout(livePlayTimerRef.current);

    const score = calculateAuditoryScore(activeTargetFreq, currentGuessFreq);
    const newResult: PlayerRoundResult = {
      playerId: activePlayer.id,
      roundIndex: roundIdx,
      guessFrequency: currentGuessFreq,
      targetFrequency: activeTargetFreq,
      score,
    };

    setGuesses(prev => [...prev, newResult]);

    if (score === 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioManager.play('wheelWin');
    } else if (score >= 9.0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioManager.play('success');
    } else if (score >= 7.0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      AudioManager.play('match');
    } else if (score < 5.0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      AudioManager.play('wrong');
    } else {
      Haptics.selectionAsync();
      AudioManager.play('tileFlip');
    }

    setPhase('roundResult');
  };

  const handleContinueFromRoundResult = async () => {
    await stopActiveSound();
    
    const isLastPlayer = playerIdx + 1 >= players.length;
    if (isLastPlayer) {
      const isLastRound = roundIdx + 1 >= maxRounds;
      if (isLastRound) {
        AudioManager.play('gameOver');
        setPhase('results');
      } else {
        setPlayerIdx(0);
        setRoundIdx(r => r + 1);
        setPhase('ready');
      }
    } else {
      setPlayerIdx(p => p + 1);
      setPhase('ready');
    }
  };

  // Compile final standings list
  const scoreboardEntries = useMemo<RankEntry[]>(() => {
    return players.map(p => {
      const playerGuesses = guesses.filter(g => g.playerId === p.id);
      const totalScore = playerGuesses.reduce((sum, g) => sum + g.score, 0);
      return {
        id: p.id,
        name: p.displayName,
        primary: `${totalScore.toFixed(2)} pts`,
        secondary: `${(totalScore / Math.max(1, playerGuesses.length)).toFixed(2)} avg. score`,
        scoreValue: totalScore,
      };
    }).sort((a, b) => b.scoreValue - a.scoreValue);
  }, [guesses, players]);

  // ─── Vertical Slider Touch Handler ─────────────────────────────────
  const trackPageYRef = useRef(0);

  const handleSliderGrant = (e: GestureResponderEvent) => {
    setIsDragging(true);
    const { pageY, locationY } = e.nativeEvent;
    trackPageYRef.current = pageY - locationY;

    // Calculate initial frequency on touch down
    const clampedY = Math.max(0, Math.min(SLIDER_HEIGHT, locationY));
    const freq = positionToFreq(clampedY);
    const clampedFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, Math.round(freq)));
    setCurrentGuessFreq(clampedFreq);
    schedulePlayLive(clampedFreq);
    Haptics.selectionAsync();
  };

  const handleSliderMove = (e: GestureResponderEvent) => {
    const { pageY } = e.nativeEvent;
    const relativeY = pageY - trackPageYRef.current;
    const clampedY = Math.max(0, Math.min(SLIDER_HEIGHT, relativeY));
    const freq = positionToFreq(clampedY);
    const clampedFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, Math.round(freq)));
    
    setCurrentGuessFreq(clampedFreq);
    schedulePlayLive(clampedFreq);
    
    if (clampedFreq !== lastPlayedFreqRef.current && clampedFreq % 50 === 0) {
      Haptics.selectionAsync();
    }
  };

  const handleSliderRelease = () => {
    setIsDragging(false);
    // Play the final frequency clearly when finger lifts
    if (livePlayTimerRef.current) clearTimeout(livePlayTimerRef.current);
    lastPlayedFreqRef.current = currentGuessFreq;
    playFrequency(currentGuessFreq, 1.0, false);
  };

  const adjustFreq = (delta: number) => {
    const newFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, currentGuessFreq + delta));
    setCurrentGuessFreq(newFreq);
    Haptics.selectionAsync();
    // Play the tone briefly to let player hear the precise change
    playFrequency(newFreq, 0.8, false);
  };

  // ─── RENDER ────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <GamePassPhoneView
        playerName={activePlayer.displayName}
        title={`Round ${roundIdx + 1} of ${maxRounds}`}
        subtitle="Listen closely to the tone, then recreate it!"
        onReady={() => {
          setPhase('memorize');
          setIsPlayingTarget(false);
          setIsPlayingGuess(false);
        }}
      />
    );
  }

  if (phase === 'memorize') {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={st.container}>
        <View style={st.card}>
          <Text style={st.sectionTitle}>Target Tone</Text>
          <Text style={st.countdownLabel}>Listen and memorize the pitch</Text>

          <View style={st.visualizerContainer}>
            <Animated.View style={[st.pulseRing, pulseAnimatedStyle]} />
            <TouchableOpacity
              onPress={() => playFrequency(activeTargetFreq, 1.8, true)}
              style={[st.playBigButton, isPlayingTarget && st.playBigButtonActive]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FF2D55', '#D32F2F', '#9C27B0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <IconSymbol name={isPlayingTarget ? 'waveform' : 'play.fill'} size={40} color="white" />
            </TouchableOpacity>
          </View>

          {/* Symmetrical dynamic wave visualizer */}
          <View style={st.visualizerWaveContainer}>
            <SoundWaveBar active={isPlayingTarget} height={16} delay={0} />
            <SoundWaveBar active={isPlayingTarget} height={28} delay={90} />
            <SoundWaveBar active={isPlayingTarget} height={42} delay={180} />
            <SoundWaveBar active={isPlayingTarget} height={52} delay={270} />
            <SoundWaveBar active={isPlayingTarget} height={42} delay={360} />
            <SoundWaveBar active={isPlayingTarget} height={28} delay={450} />
            <SoundWaveBar active={isPlayingTarget} height={16} delay={540} />
          </View>

          <Text style={st.instructionsText}>
            {isPlayingTarget ? 'Playing target frequency...' : 'Tap the button to play the tone'}
          </Text>

          <TouchableOpacity style={st.readyMatchButton} onPress={handleStartMatch} activeOpacity={0.8}>
            <LinearGradient
              colors={[Colors.blue, '#1D62CD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.readyMatchButtonText}>I'm Ready to Match</Text>
              <IconSymbol name="arrow.right" size={16} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (phase === 'recreate') {
    const thumbY = freqToPosition(currentGuessFreq);
    const freqPct = (currentGuessFreq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
    // Color transitions from deep red (low) through orange, yellow, green, cyan, blue, to purple (high)
    const hue = freqPct * 270; // 0° red → 270° purple
    const glowColor = `hsl(${Math.round(hue)}, 85%, 55%)`;

    return (
      <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={st.container}>
        <View style={st.recreateHeader}>
          <Text style={st.recreateRound}>Round {roundIdx + 1} of {maxRounds}</Text>
          <Text style={st.recreatePlayer}>{activePlayer.displayName}</Text>
        </View>

        {/* Main area: vertical slider + frequency display */}
        <View style={st.recreateBody}>
          {/* Left side: vertical slider */}
          <View style={st.vSliderArea}>
            {/* Scale labels */}
            <View style={st.scaleLabels}>
              <Text style={st.scaleLabelText}>1000</Text>
              <Text style={st.scaleLabelText}>800</Text>
              <Text style={st.scaleLabelText}>600</Text>
              <Text style={st.scaleLabelText}>400</Text>
              <Text style={st.scaleLabelText}>200</Text>
            </View>

            {/* Vertical slider wrapper (Up button, slider, Down button) */}
            <View style={st.vSliderTrackWrapper}>
              {/* Up button to increase frequency by 1 Hz */}
              <TouchableOpacity
                onPress={() => adjustFreq(1)}
                style={st.fineTuneBtn}
                activeOpacity={0.7}
              >
                <IconSymbol name="chevron.up" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              {/* The slider track */}
              <View
                style={st.vSliderTrackContainer}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={handleSliderGrant}
                onResponderMove={handleSliderMove}
                onResponderRelease={handleSliderRelease}
                onResponderTerminate={handleSliderRelease}
              >
                {/* Gradient track background */}
                <LinearGradient
                  colors={['#9B59B6', '#3498DB', '#2ECC71', '#F1C40F', '#E74C3C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={st.vSliderTrack}
                  pointerEvents="none"
                />

                {/* Filled portion glow */}
                <View 
                  pointerEvents="none"
                  style={[st.vSliderFill, { top: thumbY, backgroundColor: glowColor + '25' }]} 
                />

                {/* Thumb */}
                <View
                  pointerEvents="none"
                  style={[
                    st.vSliderThumb,
                    { top: thumbY - 18, borderColor: glowColor },
                  ]}
                >
                  <View style={[st.vSliderThumbInner, { backgroundColor: glowColor }]} />
                </View>
              </View>

              {/* Down button to decrease frequency by 1 Hz */}
              <TouchableOpacity
                onPress={() => adjustFreq(-1)}
                style={st.fineTuneBtn}
                activeOpacity={0.7}
              >
                <IconSymbol name="chevron.down" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* Hz unit label */}
            <Text style={st.hzUnitLabel}>Hz</Text>
          </View>

          {/* Right side: frequency display + play button */}
          <View style={st.freqDisplayArea}>
            <TouchableOpacity
              onPress={() => playFrequency(currentGuessFreq, 1.2, false)}
              activeOpacity={0.8}
              style={[st.freqCircle, { borderColor: glowColor, shadowColor: glowColor }]}
            >
              <Animated.View style={[st.freqPulseRing, pulseAnimatedStyle, { borderColor: glowColor, backgroundColor: glowColor + '20' }]} />
              <Text style={[st.freqBigNumber, { color: glowColor }]}>
                {Math.round(currentGuessFreq)}
              </Text>
              <Text style={st.freqUnit}>Hz</Text>
              {isPlayingGuess && (
                <View style={st.playingIndicator}>
                  <IconSymbol name="waveform" size={20} color={glowColor} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={st.dragHint}>
              {isDragging ? 'Release to hear tone' : 'Drag or tap circle to hear'}
            </Text>

            {/* Symmetrical dynamic wave visualizer in recreate phase */}
            <View style={st.visualizerWaveContainerSmall}>
              <SoundWaveBar active={isPlayingGuess} height={12} delay={0} color={glowColor} />
              <SoundWaveBar active={isPlayingGuess} height={22} delay={80} color={glowColor} />
              <SoundWaveBar active={isPlayingGuess} height={32} delay={160} color={glowColor} />
              <SoundWaveBar active={isPlayingGuess} height={22} delay={240} color={glowColor} />
              <SoundWaveBar active={isPlayingGuess} height={12} delay={320} color={glowColor} />
            </View>
          </View>
        </View>

        <TouchableOpacity style={st.submitButton} onPress={handleSubmitGuess} activeOpacity={0.8}>
          <LinearGradient
            colors={[Colors.green, '#248A3D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={st.submitButtonText}>Submit Match</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (phase === 'roundResult') {
    const lastResult = guesses[guesses.length - 1];
    const isGoodScore = lastResult.score >= 7.5;

    const targetPct = (lastResult.targetFrequency - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
    const guessPct = (lastResult.guessFrequency - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
    const targetHue = targetPct * 270;
    const guessHue = guessPct * 270;
    const targetColor = `hsl(${Math.round(targetHue)}, 85%, 55%)`;
    const guessColor = `hsl(${Math.round(guessHue)}, 85%, 55%)`;

    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={st.container}>
        <View style={st.roundResultCard}>
          <Text style={st.roundResultPlayer}>{activePlayer.displayName}'s Result</Text>
          
          <View style={st.scoreBubbleContainer}>
            <View style={[st.scoreBubble, { borderColor: isGoodScore ? Colors.green : Colors.orange }]}>
              <Text style={st.scoreValue}>{lastResult.score.toFixed(2)}</Text>
              <Text style={st.scoreMax}>/ 10</Text>
            </View>
            
            {/* Animated Feedback Badge */}
            {feedbackConfig && (
              <Animated.View style={[st.feedbackBadge, animatedBadgeStyle, { backgroundColor: feedbackConfig.color + '15', borderColor: feedbackConfig.color }]}>
                <IconSymbol name={feedbackConfig.icon as any} size={15} color={feedbackConfig.color} />
                <Text style={[st.feedbackBadgeText, { color: feedbackConfig.color }]}>{feedbackConfig.text}</Text>
              </Animated.View>
            )}
          </View>

          {/* Frequency comparison bars */}
          <View style={st.comparisonContainer}>
            <View style={st.comparisonRow}>
              <View style={st.comparisonLabelCol}>
                <Text style={st.comparisonLabel}>Target</Text>
              </View>
              <TouchableOpacity
                onPress={() => playFrequency(activeTargetFreq, 1.5, true)}
                style={[st.comparisonBar, { backgroundColor: targetColor + '15', borderColor: targetColor }]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[targetColor + '10', targetColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.comparisonBarFill, { width: `${targetPct * 100}%` }]}
                />
                <View style={st.comparisonBarContent}>
                  <IconSymbol name={isPlayingTarget ? 'waveform' : 'play.fill'} size={16} color="white" />
                  <Text style={st.comparisonFreqText}>{Math.round(lastResult.targetFrequency)} Hz</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={st.comparisonRow}>
              <View style={st.comparisonLabelCol}>
                <Text style={st.comparisonLabel}>Yours</Text>
              </View>
              <TouchableOpacity
                onPress={() => playFrequency(lastResult.guessFrequency, 1.5, false)}
                style={[st.comparisonBar, { backgroundColor: guessColor + '15', borderColor: guessColor }]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[guessColor + '10', guessColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.comparisonBarFill, { width: `${guessPct * 100}%` }]}
                />
                <View style={st.comparisonBarContent}>
                  <IconSymbol name={isPlayingGuess ? 'waveform' : 'play.fill'} size={16} color="white" />
                  <Text style={st.comparisonFreqText}>{Math.round(lastResult.guessFrequency)} Hz</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Difference indicator */}
            <View style={st.diffBadge}>
              <Text style={st.diffText}>
                Δ {Math.abs(Math.round(lastResult.targetFrequency - lastResult.guessFrequency))} Hz
              </Text>
            </View>
          </View>

          <TouchableOpacity style={st.continueButton} onPress={handleContinueFromRoundResult} activeOpacity={0.8}>
            <LinearGradient
              colors={[Colors.blue, '#1D62CD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.continueButtonText}>
                {playerIdx + 1 < players.length ? 'Pass to Next Player' : roundIdx + 1 < maxRounds ? 'Next Round' : 'View Final Standings'}
              </Text>
              <IconSymbol name="arrow.right" size={18} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <ScrollView style={st.scrollView} contentContainerStyle={st.scrollContent}>
      <ResultsScoreboard
        entries={scoreboardEntries}
        title="Final Leaderboard"
        shareGameName="Sound Match"
        onPlayAgain={() => {
          setPhase('ready');
          setRoundIdx(0);
          setPlayerIdx(0);
          setGuesses([]);
        }}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Viral-Black',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 24,
  },
  visualizerContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 45, 85, 0.3)',
    borderWidth: 2,
    borderColor: '#FF2D55',
  },
  playBigButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  playBigButtonActive: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  visualizerWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    marginVertical: 12,
    width: '100%',
  },
  instructionsText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 32,
    textAlign: 'center',
  },
  readyMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.blue,
    paddingHorizontal: 28,
    height: 52,
    borderRadius: 20,
    width: '100%',
    overflow: 'hidden',
  },
  readyMatchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 1,
  },

  // ─── Recreate Phase ─────────────────────
  recreateHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  recreateRound: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recreatePlayer: {
    fontSize: 24,
    fontFamily: 'Viral-Black',
    color: 'white',
  },
  recreateBody: {
    flexDirection: 'row',
    width: '100%',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    maxHeight: SLIDER_HEIGHT + 100,
  },

  // ─── Vertical Slider ────────────────────
  vSliderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SLIDER_HEIGHT + 80,
    gap: 6,
  },
  vSliderTrackWrapper: {
    height: SLIDER_HEIGHT + 80,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fineTuneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleLabels: {
    height: SLIDER_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 2,
    marginVertical: 40,
  },
  scaleLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    fontVariant: ['tabular-nums'],
  },
  vSliderTrackContainer: {
    width: 48,
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  vSliderTrack: {
    width: 14,
    height: '100%',
    borderRadius: 7,
  },
  vSliderFill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    borderRadius: 7,
  },
  vSliderThumb: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  vSliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hzUnitLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.2)',
    position: 'absolute',
    bottom: -18,
    alignSelf: 'center',
  },

  // ─── Frequency Display ──────────────────
  freqDisplayArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  freqCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  freqPulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  freqBigNumber: {
    fontSize: 44,
    fontFamily: 'Viral-Black',
    textAlign: 'center',
  },
  freqUnit: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginTop: -4,
  },
  playingIndicator: {
    position: 'absolute',
    bottom: 16,
  },
  dragHint: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  visualizerWaveContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginTop: 8,
    width: '100%',
  },
  replayTargetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,45,85,0.4)',
    backgroundColor: 'rgba(255,45,85,0.08)',
  },
  replayTargetText: {
    color: '#FF2D55',
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Submit Button ──────────────────────
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 10,
  },
  feedbackBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ─── Round Result ───────────────────────
  roundResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  roundResultPlayer: {
    fontSize: 20,
    fontFamily: 'Viral-Black',
    color: '#ffffff',
    textAlign: 'center',
  },
  scoreBubbleContainer: {
    alignItems: 'center',
    gap: 6,
  },
  scoreBubble: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreValue: {
    fontSize: 32,
    fontFamily: 'Viral-Black',
    color: 'white',
  },
  scoreMax: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 2,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  // ─── Frequency comparison bars ──────────
  comparisonContainer: {
    width: '100%',
    gap: 10,
    marginVertical: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  comparisonLabelCol: {
    width: 52,
    alignItems: 'flex-end',
  },
  comparisonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  comparisonBar: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  comparisonBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    opacity: 0.35,
  },
  comparisonBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    zIndex: 1,
  },
  comparisonFreqText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  diffBadge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 4,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    fontVariant: ['tabular-nums'],
  },

  // ─── Continue Button ────────────────────
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.blue,
    width: '100%',
    height: 54,
    borderRadius: 20,
    marginTop: 8,
    overflow: 'hidden',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 1,
  },
});
