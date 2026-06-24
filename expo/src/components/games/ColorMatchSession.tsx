import { Colors, Typography } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, TouchableOpacity, GestureResponderEvent, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from '@/src/utils/safeHaptics';
import { AudioManager } from '@/src/services/AudioManager';
import { GamePassPhoneView, GamePlayerCompleteView } from './SharedGameComponents';
import { ResultsScoreboard, RankEntry } from './ResultsScoreboard';
import { useRegisterSkip } from '@/src/contexts/GameSkipContext';
import { LinearGradient } from 'expo-linear-gradient';

interface Props { session: GameSession; }
type Phase = 'ready' | 'memorize' | 'recreate' | 'roundResult' | 'results';

interface PlayerRoundResult {
  playerId: string;
  roundIndex: number;
  guess: { h: number; s: number; b: number };
  target: { h: number; s: number; b: number };
  score: number;
}

// Convert HSV/HSB to HSL for CSS/Style sheet rendering
function hsvToHsl(h: number, s: number, v: number): string {
  const sDec = s / 100;
  const vDec = v / 100;
  
  let l = vDec * (1 - sDec / 2);
  let sHsl = 0;
  if (l > 0 && l < 1) {
    sHsl = (vDec - l) / Math.min(l, 1 - l);
  }
  
  const hInt = Math.round(h);
  const sInt = Math.round(sHsl * 100);
  const lInt = Math.round(l * 100);
  
  return `hsl(${hInt}, ${sInt}%, ${lInt}%)`;
}

// Compute proximity score (0 to 10) in HSV cylindrical coordinates
function calculateScore(target: { h: number; s: number; b: number }, guess: { h: number; s: number; b: number }): number {
  const h1 = target.h * (Math.PI / 180);
  const s1 = target.s / 100;
  const v1 = target.b / 100;

  const h2 = guess.h * (Math.PI / 180);
  const s2 = guess.s / 100;
  const v2 = guess.b / 100;

  // Convert to cylindrical coordinates:
  // x = S * V * cos(H), y = S * V * sin(H), z = V
  const x1 = s1 * v1 * Math.cos(h1);
  const y1 = s1 * v1 * Math.sin(h1);
  const z1 = v1;

  const x2 = s2 * v2 * Math.cos(h2);
  const y2 = s2 * v2 * Math.sin(h2);
  const z2 = v2;

  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Maximum possible distance in this space is 2.0 (e.g. Red vs Cyan)
  const normDist = Math.min(1.0, dist / 2.0);
  
  // Similarity score out of 10
  const rawScore = 10 * (1 - normDist);
  return Math.max(0, Math.round(rawScore * 100) / 100); // 2 decimal places
}

export function ColorMatchSession({ session }: Props) {
  const players = session.players;
  const registerSkip = useRegisterSkip();

  const maxRounds = session.maxRounds || 5;

  // Target colors for all rounds generated once
  const [targetColors] = useState<{ h: number; s: number; b: number }[]>(() => {
    return Array.from({ length: maxRounds }, () => ({
      h: Math.floor(Math.random() * 360),
      s: Math.floor(65 + Math.random() * 35), // 65-100% Saturation
      b: Math.floor(55 + Math.random() * 35), // 55-90% Brightness
    }));
  });

  const [phase, setPhase] = useState<Phase>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [playerIdx, setPlayerIdx] = useState(0);
  
  const [currentGuess, setCurrentGuess] = useState({ h: 180, s: 50, b: 50 });
  const [guesses, setGuesses] = useState<PlayerRoundResult[]>([]);
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState(4);

  const memorizeProgress = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activePlayer = players[playerIdx];
  const activeTargetColor = targetColors[roundIdx];

  // Memorize timer progress bar style
  const timerAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${memorizeProgress.value * 100}%`,
    };
  });

  // Skip logic
  useEffect(() => {
    if (phase === 'memorize' || phase === 'recreate') {
      registerSkip(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Register a 0 score for this round
        const newResult: PlayerRoundResult = {
          playerId: activePlayer.id,
          roundIndex: roundIdx,
          guess: { h: 0, s: 0, b: 0 },
          target: activeTargetColor,
          score: 0,
        };

        setGuesses(prev => [...prev, newResult]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        AudioManager.play('fail');

        // Transition
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
    return () => registerSkip(null);
  }, [phase, playerIdx, roundIdx, activePlayer, activeTargetColor]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartMemorize = () => {
    setPhase('memorize');
    setMemorizeTimeLeft(4);
    memorizeProgress.value = 1;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    AudioManager.play('countdown');

    memorizeProgress.value = withTiming(0, {
      duration: 4000,
      easing: Easing.linear,
    });

    let elapsed = 4;
    timerRef.current = setInterval(() => {
      elapsed -= 1;
      setMemorizeTimeLeft(elapsed);
      if (elapsed <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhase('recreate');
        // Reset guess to neutral values
        setCurrentGuess({ h: 180, s: 50, b: 50 });
      } else {
        Haptics.selectionAsync();
      }
    }, 1000);
  };

  const handleSubmitGuess = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const score = calculateScore(activeTargetColor, currentGuess);
    const newResult: PlayerRoundResult = {
      playerId: activePlayer.id,
      roundIndex: roundIdx,
      guess: currentGuess,
      target: activeTargetColor,
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

  const handleContinueFromRoundResult = () => {
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

  // Compile final scoreboard rankings
  const scoreboardEntries = useMemo<RankEntry[]>(() => {
    return players.map(p => {
      const playerGuesses = guesses.filter(g => g.playerId === p.id);
      const totalScore = playerGuesses.reduce((sum, g) => sum + g.score, 0);
      return {
        id: p.id,
        name: p.displayName,
        primary: `${totalScore.toFixed(2)} pts`,
        secondary: `${(totalScore / Math.max(1, guesses.filter(g => g.playerId === p.id).length)).toFixed(2)} avg. score`,
        scoreValue: totalScore,
      };
    }).sort((a, b) => b.scoreValue - a.scoreValue);
  }, [guesses, players]);

  if (phase === 'ready') {
    return (
      <GamePassPhoneView
        playerName={activePlayer.displayName}
        title={`Round ${roundIdx + 1} of ${maxRounds}`}
        subtitle="Memorize the target color, then recreate it!"
        onReady={handleStartMemorize}
      />
    );
  }

  if (phase === 'memorize') {
    const targetHsl = hsvToHsl(activeTargetColor.h, activeTargetColor.s, activeTargetColor.b);
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={st.container}>
        <View style={st.card}>
          <Text style={st.sectionTitle}>Memorize this Color</Text>
          <Text style={st.countdownLabel}>Closing in {memorizeTimeLeft}s...</Text>
          
          <View style={[st.colorSwatch, { backgroundColor: targetHsl, shadowColor: targetHsl }]} />
          
          <View style={st.progressTrack}>
            <Animated.View style={[st.progressBar, timerAnimatedStyle, { backgroundColor: targetHsl }]} />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (phase === 'recreate') {
    const guessHsl = hsvToHsl(currentGuess.h, currentGuess.s, currentGuess.b);

    return (
      <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={st.container}>
        <View style={st.recreateHeader}>
          <Text style={st.recreateRound}>Round {roundIdx + 1} of {maxRounds}</Text>
          <Text style={st.recreatePlayer}>{activePlayer.displayName}</Text>
        </View>

        <View style={st.singleSwatchContainer}>
          <View style={[st.colorSwatchLarge, { backgroundColor: guessHsl, shadowColor: guessHsl }]} />
          <Text style={st.swatchLabel}>Your Guess</Text>
        </View>

        <View style={st.slidersContainer}>
          {/* Hue Slider */}
          <ColorSlider
            label="Hue"
            value={currentGuess.h}
            min={0}
            max={360}
            formatValue={(v) => `${Math.round(v)}°`}
            onChange={(h) => setCurrentGuess(prev => ({ ...prev, h }))}
            iconName="paintpalette.fill"
            thumbColor={guessHsl}
            renderTrack={() => (
              <LinearGradient
                colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.sliderTrack}
              />
            )}
          />

          {/* Saturation Slider */}
          <ColorSlider
            label="Saturation"
            value={currentGuess.s}
            min={0}
            max={100}
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(s) => setCurrentGuess(prev => ({ ...prev, s }))}
            iconName="drop.fill"
            thumbColor={guessHsl}
            renderTrack={() => (
              <LinearGradient
                colors={['#ffffff', hsvToHsl(currentGuess.h, 100, currentGuess.b)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.sliderTrack}
              />
            )}
          />

          {/* Brightness Slider */}
          <ColorSlider
            label="Brightness"
            value={currentGuess.b}
            min={0}
            max={100}
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(b) => setCurrentGuess(prev => ({ ...prev, b }))}
            iconName="sun.max.fill"
            thumbColor={guessHsl}
            renderTrack={() => (
              <LinearGradient
                colors={['#000000', hsvToHsl(currentGuess.h, currentGuess.s, 100)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.sliderTrack}
              />
            )}
          />
        </View>

        <TouchableOpacity style={st.submitButton} onPress={handleSubmitGuess} activeOpacity={0.85}>
          <Text style={st.submitButtonText}>Submit Match</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (phase === 'roundResult') {
    const lastResult = guesses[guesses.length - 1];
    const targetHsl = hsvToHsl(activeTargetColor.h, activeTargetColor.s, activeTargetColor.b);
    const guessHsl = hsvToHsl(lastResult.guess.h, lastResult.guess.s, lastResult.guess.b);
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
            <Text style={st.scoreLabel}>{isGoodScore ? 'Excellent match!' : 'Could be closer...'}</Text>
          </View>

          <View style={st.overlappingSwatchesContainer}>
            <View style={st.overlappingSwatchesRow}>
              <View style={[st.colorSwatchMedium, { backgroundColor: targetHsl, shadowColor: targetHsl, zIndex: 1 }]} />
              <View style={[st.colorSwatchMedium, { backgroundColor: guessHsl, shadowColor: guessHsl, marginLeft: -60, zIndex: 2 }]} />
            </View>
            
            <View style={st.overlapLabelsRow}>
              <View style={st.overlapLabelCol}>
                <Text style={st.swatchLabel}>Target</Text>
                <Text style={st.colorValCode}>{`H:${Math.round(activeTargetColor.h)}° S:${Math.round(activeTargetColor.s)}% B:${Math.round(activeTargetColor.b)}%`}</Text>
              </View>
              <View style={st.overlapLabelCol}>
                <Text style={st.swatchLabel}>Your Guess</Text>
                <Text style={st.colorValCode}>{`H:${Math.round(lastResult.guess.h)}° S:${Math.round(lastResult.guess.s)}% B:${Math.round(lastResult.guess.b)}%`}</Text>
              </View>
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
        shareGameName="Color Match"
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
  iconName,
  thumbColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  renderTrack: () => React.ReactNode;
  formatValue: (val: number) => string;
  iconName: 'paintpalette.fill' | 'drop.fill' | 'sun.max.fill';
  thumbColor: string;
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
    if (Math.round(val) % 5 === 0) {
      Haptics.selectionAsync();
    }
  };

  return (
    <View style={st.sliderContainer}>
      <View style={st.sliderLabelRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconSymbol name={iconName} size={15} color="rgba(255,255,255,0.7)" />
          <Text style={st.sliderLabel}>{label}</Text>
        </View>
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
        >
          <View style={[st.sliderThumbInner, { backgroundColor: thumbColor }]} />
        </View>
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
  colorSwatch: {
    width: 280,
    height: 280,
    borderRadius: 140,
    marginBottom: 32,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
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
  },
  swatchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  colorSwatchSmall: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchOutline: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  colorValCode: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
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
  defaultTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    top: 2, // Centered inside track container height of 32 (thumb size is 28)
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderThumbInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  submitButtonText: {
    color: '#121212',
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
    overflow: 'hidden',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 1,
  },
  colorSwatchMedium: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchLarge: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 12,
  },
  singleSwatchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  overlappingSwatchesContainer: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  overlappingSwatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlapLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  overlapLabelCol: {
    alignItems: 'center',
    width: '45%',
  },
});
