import { GameSlider, GameActionButton, GameControlCard, MatchPreview } from './GameControls';
import { useGameActivity, GAME_UI } from './GameActivity';
import { Colors, Typography } from '@/src/theme/Colors';
import { webSliderGestureStyle } from '@/src/theme/webGestureStyle';
import { MatchStudio } from './MatchStudio';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, TouchableOpacity, GestureResponderEvent, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
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
  skipped?: boolean;
  playerId: string;
  roundIndex: number;
  guess: { h: number; s: number; b: number };
  target: { h: number; s: number; b: number };
  score: number;
}

import { hsvToHsl, calculateColorMatchScore } from '@/src/utils/colorMatchMath';

const calculateScore = calculateColorMatchScore;

export function ColorMatchSession({ session }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const { height: viewportHeight } = useWindowDimensions();
  const swatchHeight = Math.min(360, Math.max(160, viewportHeight - 710));
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

  const activePlayer = players[playerIdx];
  useGameActivity(activePlayer?.displayName, phase);
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
          skipped: true,
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
      const playerGuesses = guesses.filter(g => g.playerId === p.id && !g.skipped);
      const isSkipped = playerGuesses.length === 0;
      const totalScore = playerGuesses.reduce((sum, g) => sum + g.score, 0);
      return {
        id: p.id,
        name: p.displayName,
        isSkipped,
        primary: isSkipped ? 'Skipped' : `${totalScore.toFixed(2)} pts`,
        secondary: isSkipped ? 'Did not play' : `${(totalScore / playerGuesses.length).toFixed(2)} avg. score`,
        scoreValue: totalScore,
      };
    }).sort((a, b) => {
      if (a.isSkipped !== b.isSkipped) return a.isSkipped ? 1 : -1;
      return b.scoreValue - a.scoreValue;
    });
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
      <MatchStudio kind="color" step={0} player={activePlayer.displayName} round={`${roundIdx + 1} / ${maxRounds}`}>
        <View style={st.card}>
          <Text style={st.sectionTitle}>Memorize this Color</Text>
          <Text style={st.countdownLabel}>Closing in {memorizeTimeLeft}s...</Text>
          
          <View style={[st.colorSwatch, { height: Math.max(260, swatchHeight), backgroundColor: targetHsl, shadowColor: targetHsl }]} />
          
          <View style={st.progressTrack}>
            <Animated.View style={[st.progressBar, timerAnimatedStyle, { backgroundColor: targetHsl }]} />
          </View>
        </View>
      </MatchStudio>
    );
  }

  if (phase === 'recreate') {
    const guessHsl = hsvToHsl(currentGuess.h, currentGuess.s, currentGuess.b);

    return (
      <MatchStudio scrollEnabled={!isDragging} kind="color" step={1} player={activePlayer.displayName} round={`${roundIdx + 1} / ${maxRounds}`}>
        <MatchPreview color={guessHsl} />
        <GameControlCard>
          {/* Hue Slider */}
          <GameSlider
            onDraggingChange={setIsDragging}
            label="Hue"
            value={currentGuess.h}
            min={0}
            max={360}
            formatValue={(v) => `${Math.round(v)}°`}
            onChange={(h) => setCurrentGuess(prev => ({ ...prev, h }))}
            testID="color-slider-hue"
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
          <GameSlider
            onDraggingChange={setIsDragging}
            label="Saturation"
            value={currentGuess.s}
            min={0}
            max={100}
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(s) => setCurrentGuess(prev => ({ ...prev, s }))}
            testID="color-slider-saturation"
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
          <GameSlider
            onDraggingChange={setIsDragging}
            label="Brightness"
            value={currentGuess.b}
            min={0}
            max={100}
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(b) => setCurrentGuess(prev => ({ ...prev, b }))}
            testID="color-slider-brightness"
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
        </GameControlCard>
        <GameActionButton testID="color-match-submit-button" onPress={handleSubmitGuess} />
      </MatchStudio>
    );
  }

  if (phase === 'roundResult') {
    const lastResult = guesses[guesses.length - 1];
    const targetHsl = hsvToHsl(activeTargetColor.h, activeTargetColor.s, activeTargetColor.b);
    const guessHsl = hsvToHsl(lastResult.guess.h, lastResult.guess.s, lastResult.guess.b);
    const isGoodScore = lastResult.score >= 7.5;

    return (
      <MatchStudio kind="color" step={2} player={activePlayer.displayName} round={`${roundIdx + 1} / ${maxRounds}`}>
        <View style={st.roundResultCard}>
          <Text style={st.roundResultPlayer}>{activePlayer?.displayName} · Result</Text>
          
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

          <View style={st.overlappingSwatchesContainer}>
            <View style={st.overlappingSwatchesRow}>
              <View style={[st.colorSwatchMedium, { backgroundColor: targetHsl, shadowColor: targetHsl, zIndex: 1 }]} />
              <View style={[st.colorSwatchMedium, { backgroundColor: guessHsl, shadowColor: guessHsl, marginLeft: 12, zIndex: 2 }]} />
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

          <TouchableOpacity testID="color-match-continue-button" style={st.continueButton} onPress={handleContinueFromRoundResult} activeOpacity={0.8} accessibilityRole="button">
            <LinearGradient
              colors={[Colors.blue, '#1D62CD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.continueButtonText}>
                {playerIdx + 1 < players.length ? 'Pass to Next Player' : roundIdx + 1 < maxRounds ? 'Next Round' : 'View Final Standings'}
              </Text>
              <IconSymbol name="arrow.right" size={18} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </MatchStudio>
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
export const st = StyleSheet.create({
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
    backgroundColor: 'transparent',
    borderRadius: 28,
    borderWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 4,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0,
    shadowRadius: 20,
    elevation: 0,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: 'System',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '600',
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B1BDCF',
    marginBottom: 16,
  },
  colorSwatch: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 20,
    elevation: 0,
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
    color: '#BCC6D7',
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
    fontSize: 10,
    color: '#ADB8CA',
    fontWeight: '500',
    marginTop: 4,
  },
  slidersContainer: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    gap: 10,
    marginVertical: 0,
  },
  sliderContainer: {
    width: '100%',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sliderValueText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.6)',
  },
  sliderTrackContainer: {
    ...webSliderGestureStyle,
    height: 44,
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
    top: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginLeft: -18, // Centered on left position
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
    maxWidth: 540,
    alignSelf: 'center',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  submitButtonText: {
    color: '#121212',
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
  roundResultCard: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    borderWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 4,
    alignItems: 'center',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
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
    fontSize: 40,
    fontFamily: 'System',
    color: 'white',
    fontWeight: '600',
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
    maxWidth: 540,
    alignSelf: 'center',
    height: 54,
    marginTop: 16,
    overflow: 'hidden', minHeight: GAME_UI.primaryButton.minHeight, borderRadius: GAME_UI.primaryButton.borderRadius },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 1,
  },
  colorSwatchMedium: {
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0,
    shadowRadius: 10,
    elevation: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchLarge: {
    width: '100%',
    height: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 16,
    elevation: 0,
    marginBottom: 8,
  },
  singleSwatchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    width: '100%',
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
    paddingHorizontal: 0,
    marginTop: 8,
  },
  overlapLabelCol: {
    alignItems: 'center',
    width: '45%',
  },
});
