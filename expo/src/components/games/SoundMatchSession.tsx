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

  // Generate sine wave
  const amplitude = 32767 * 0.45; // Moderate volume to prevent harshness
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
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
  // Compute difference in octaves: diff = abs(log2(target / guess))
  const diff = Math.abs(Math.log2(target / guess));
  
  // Define maximum tolerable difference as 1.2 octaves (about a 10th interval)
  const maxDiff = 1.2;
  const normDiff = Math.min(1.0, diff / maxDiff);
  
  // Power factor of 1.2 to give slightly better rewards for closer matches
  const rawScore = 10 * Math.pow(1 - normDiff, 1.2);
  return Math.max(0, Math.round(rawScore * 100) / 100);
}

export function SoundMatchSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();
  const maxRounds = session.maxRounds || 5;

  // Generate target frequencies for all rounds (between 250 Hz and 900 Hz)
  const [targetFrequencies] = useState<number[]>(() => {
    return Array.from({ length: maxRounds }, () => {
      // Pick discrete notes/intervals to make it sound pleasant and memorable
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

  const activeSoundRef = useRef<Audio.Sound | null>(null);
  const activePlayer = players[playerIdx];
  const activeTargetFreq = targetFrequencies[roundIdx];

  const pulseScale = useSharedValue(1);

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
      // Play a silent pulse indicator if sound is disabled
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
    };
  }, []);

  const handleStartMatch = async () => {
    await stopActiveSound();
    setPhase('recreate');
    setCurrentGuessFreq(440); // Standard A4 tuning pitch as guess starting point
  };

  const handleSubmitGuess = async () => {
    await stopActiveSound();

    const score = calculateAuditoryScore(activeTargetFreq, currentGuessFreq);
    const newResult: PlayerRoundResult = {
      playerId: activePlayer.id,
      roundIndex: roundIdx,
      guessFrequency: currentGuessFreq,
      targetFrequency: activeTargetFreq,
      score,
    };

    setGuesses(prev => [...prev, newResult]);

    if (score >= 9.0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AudioManager.play('success');
    } else if (score >= 6.0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      AudioManager.play('success');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      AudioManager.play('fail');
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
              <IconSymbol name={isPlayingTarget ? 'waveform' : 'play.fill'} size={40} color="white" />
            </TouchableOpacity>
          </View>

          <Text style={st.instructionsText}>
            {isPlayingTarget ? 'Playing target frequency...' : 'Tap the button to play the tone'}
          </Text>

          <TouchableOpacity style={st.readyMatchButton} onPress={handleStartMatch} activeOpacity={0.8}>
            <Text style={st.readyMatchButtonText}>I'm Ready to Match</Text>
            <IconSymbol name="arrow.right" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (phase === 'recreate') {
    return (
      <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={st.container}>
        <View style={st.recreateHeader}>
          <Text style={st.recreateRound}>Round {roundIdx + 1} of {maxRounds}</Text>
          <Text style={st.recreatePlayer}>{activePlayer.displayName}</Text>
        </View>

        <View style={st.swatchesRow}>
          <View style={st.swatchContainer}>
            <Text style={st.swatchLabel}>Target</Text>
            <View style={[st.audioSwatchSmall, st.swatchOutline]}>
              <IconSymbol name="eye.slash.fill" size={24} color="rgba(255,255,255,0.25)" />
            </View>
          </View>
          
          <View style={st.swatchContainer}>
            <Text style={st.swatchLabel}>Your Guess</Text>
            <Animated.View style={[st.pulseRingSmall, pulseAnimatedStyle]} />
            <TouchableOpacity
              onPress={() => playFrequency(currentGuessFreq, 1.5, false)}
              style={[st.audioSwatchSmall, { backgroundColor: Colors.orange, shadowColor: Colors.orange }]}
              activeOpacity={0.8}
            >
              <IconSymbol name={isPlayingGuess ? 'waveform' : 'play.fill'} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.slidersContainer}>
          <ColorSlider
            label="Frequency"
            value={currentGuessFreq}
            min={200}
            max={1000}
            formatValue={(v) => `${Math.round(v)} Hz`}
            onChange={(freq) => setCurrentGuessFreq(freq)}
            renderTrack={() => (
              <LinearGradient
                colors={['#FF2D55', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.sliderTrack}
              />
            )}
          />
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

    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={st.container}>
        <View style={st.roundResultCard}>
          <Text style={st.roundResultPlayer}>{activePlayer.displayName}'s Result</Text>
          
          <View style={st.scoreBubbleContainer}>
            <View style={[st.scoreBubble, { borderColor: isGoodScore ? Colors.green : Colors.orange }]}>
              <Text style={st.scoreValue}>{lastResult.score.toFixed(2)}</Text>
              <Text style={st.scoreMax}>/ 10</Text>
            </View>
            <Text style={st.scoreLabel}>{isGoodScore ? 'Spot on!' : 'A bit out of tune...'}</Text>
          </View>

          <View style={st.swatchesRow}>
            <View style={st.swatchContainer}>
              <Text style={st.swatchLabel}>Target</Text>
              <TouchableOpacity
                onPress={() => playFrequency(activeTargetFreq, 1.5, true)}
                style={[st.audioSwatchSmall, { backgroundColor: '#FF2D55', shadowColor: '#FF2D55' }]}
                activeOpacity={0.8}
              >
                <IconSymbol name={isPlayingTarget ? 'waveform' : 'play.fill'} size={24} color="white" />
              </TouchableOpacity>
              <Text style={st.freqLabelCode}>{Math.round(activeTargetFreq)} Hz</Text>
            </View>
            
            <View style={st.swatchContainer}>
              <Text style={st.swatchLabel}>Your Guess</Text>
              <TouchableOpacity
                onPress={() => playFrequency(lastResult.guessFrequency, 1.5, false)}
                style={[st.audioSwatchSmall, { backgroundColor: Colors.orange, shadowColor: Colors.orange }]}
                activeOpacity={0.8}
              >
                <IconSymbol name={isPlayingGuess ? 'waveform' : 'play.fill'} size={24} color="white" />
              </TouchableOpacity>
              <Text style={st.freqLabelCode}>{Math.round(lastResult.guessFrequency)} Hz</Text>
            </View>
          </View>

          <TouchableOpacity style={st.continueButton} onPress={handleContinueFromRoundResult} activeOpacity={0.8}>
            <Text style={st.continueButtonText}>
              {playerIdx + 1 < players.length ? 'Pass to Next Player' : roundIdx + 1 < maxRounds ? 'Next Round' : 'View Final Standings'}
            </Text>
            <IconSymbol name="arrow.right" size={18} color="white" />
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

// Custom interactive Slider using standard React Native responder system
function ColorSlider({
  label,
  value,
  min,
  max,
  onChange,
  renderTrack,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  renderTrack: () => React.ReactNode;
  formatValue: (val: number) => string;
}) {
  const [width, setWidth] = useState(1);
  const trackRef = useRef<View>(null);

  const handleTouch = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    let pct = locationX / width;
    pct = Math.max(0, Math.min(1, pct));
    const val = min + pct * (max - min);
    onChange(val);
    
    // Selection feedback haptics during adjustments
    if (Math.round(val) % 10 === 0) {
      Haptics.selectionAsync();
    }
  };

  return (
    <View style={st.sliderContainer}>
      <View style={st.sliderLabelRow}>
        <Text style={st.sliderLabel}>{label}</Text>
        <Text style={st.sliderValueText}>{formatValue(value)}</Text>
      </View>
      
      <View
        ref={trackRef}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        style={st.sliderTrackContainer}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {renderTrack()}
        </View>
        <View
          pointerEvents="none"
          style={[
            st.sliderThumb,
            {
              left: `${((value - min) / (max - min)) * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
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
  pulseRingSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 149, 0, 0.25)',
    borderWidth: 1.5,
    borderColor: '#FF9500',
    alignSelf: 'center',
    top: 25,
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
  },
  playBigButtonActive: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
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
  },
  readyMatchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recreateHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
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
  swatchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 16,
  },
  swatchContainer: {
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  swatchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  audioSwatchSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  swatchOutline: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowOpacity: 0,
    elevation: 0,
  },
  freqLabelCode: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: 4,
  },
  slidersContainer: {
    width: '100%',
    gap: 20,
    marginVertical: 12,
  },
  sliderContainer: {
    width: '100%',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sliderValueText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.6)',
  },
  sliderTrackContainer: {
    height: 32,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 12,
    borderRadius: 6,
    width: '100%',
    alignSelf: 'center',
  },
  sliderThumb: {
    position: 'absolute',
    top: 2, // Centered inside track container of height 32 (thumb size is 28)
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginLeft: -14, // Centered on left position
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    overflow: 'hidden',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Viral-Black',
  },
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.blue,
    width: '100%',
    height: 54,
    borderRadius: 20,
    marginTop: 16,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
