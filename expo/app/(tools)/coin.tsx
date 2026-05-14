import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  SharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { AudioManager } from '@/src/services/AudioManager';

const HEADS_IMG = require('@/assets/images/tools/coin-heads.png');
const TAILS_IMG = require('@/assets/images/tools/coin-tails.png');

type CoinState = {
  rotation: SharedValue<number>;
  resultIsHeads: boolean;
};

const CoinComponent = ({
  rotationSV,
  size,
  isFlipping,
  onPress,
}: {
  rotationSV: SharedValue<number>;
  size: number;
  isFlipping: boolean;
  onPress: () => void;
}) => {
  const frontStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateX: `${rotationSV.value}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateX: `${rotationSV.value + 180}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: isFlipping ? 1.05 : 1.0 }],
    };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.coinContainer, { width: size, height: size }, containerStyle]}>
        {/* Tails (Back) */}
        <Animated.View style={[styles.coinFace, backStyle]}>
          <Image source={TAILS_IMG} style={styles.coinImage} contentFit="contain" />
        </Animated.View>

        {/* Heads (Front) */}
        <Animated.View style={[styles.coinFace, frontStyle]}>
          <Image source={HEADS_IMG} style={styles.coinImage} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

export default function CoinFlipToolScreen() {
  const [coinCount, setCoinCount] = useState(1);
  const [isFlipping, setIsFlipping] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [headsCount, setHeadsCount] = useState(0);
  const [tailsCount, setTailsCount] = useState(0);

  // We allocate 2 shared values since max coins is 2
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);

  const [resultsAreHeads, setResultsAreHeads] = useState<boolean[]>([true, true]);

  const coinStates = [
    { rotation: r1, resultIsHeads: resultsAreHeads[0] },
    { rotation: r2, resultIsHeads: resultsAreHeads[1] },
  ];

  const resetStats = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AudioManager.play('buttonTap');
    setHeadsCount(0);
    setTailsCount(0);
  };

  const getResultText = () => {
    if (isFlipping) return "Flipping…";
    if (!hasResult) return "Tap to flip";
    if (coinCount === 1) {
      return coinStates[0].resultIsHeads ? "HEADS" : "TAILS";
    } else {
      const labels = coinStates.slice(0, coinCount).map(c => c.resultIsHeads ? "H" : "T");
      return labels.join("  •  ");
    }
  };

  const flip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setHasResult(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    AudioManager.play('tileFlip'); // No coin spin sound, fallback to tileFlip

    const outcomes = Array.from({ length: coinCount }, () => Math.random() > 0.5);
    
    const spinDuration = 2600;
    const settleDuration = 500;

    // Spin phase
    for (let i = 0; i < coinCount; i++) {
      const current = coinStates[i].rotation.value;
      const currentMod = ((current % 360) + 360) % 360;
      const base = current - currentMod;
      const extraSpins = Math.floor(Math.random() * 5) + 14 + i; // 14-18 spins
      const midTarget = base + extraSpins * 360 + 90;

      coinStates[i].rotation.value = withTiming(midTarget, {
        duration: spinDuration,
        easing: Easing.bezier(0.25, 0.1, 0.35, 0.7),
      });
    }

    setTimeout(() => {
      // Settle phase
      for (let i = 0; i < coinCount; i++) {
        const current = coinStates[i].rotation.value;
        const endOffset = outcomes[i] ? 360 : 180;
        const currentMod = ((current % 360) + 360) % 360;
        const base = current - currentMod;
        const target = base + endOffset;

        coinStates[i].rotation.value = withTiming(target, {
          duration: settleDuration,
          easing: Easing.bezier(0.2, 0.9, 0.3, 1.0),
        });
        
        // The local state value is updated via setResultsAreHeads later
      }

      setTimeout(() => {
        setResultsAreHeads(outcomes);
        setHasResult(true);
        setIsFlipping(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AudioManager.play('success');
        let newHeads = headsCount;
        let newTails = tailsCount;
        outcomes.forEach(outcome => {
          if (outcome) newHeads++;
          else newTails++;
        });
        setHeadsCount(newHeads);
        setTailsCount(newTails);
      }, settleDuration + 50);

    }, spinDuration);

  }, [coinCount, isFlipping, headsCount, tailsCount]);

  const handleCoinCountChange = (count: number) => {
    if (isFlipping) return;
    AudioManager.play('buttonTap');
    setCoinCount(count);
    setHasResult(false);
  };

  const { width } = useWindowDimensions();
  const coinSize = coinCount === 1 ? width * 0.6 : width * 0.4;

  return (
    <View style={styles.container}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <View style={[styles.statDot, { backgroundColor: Colors.yellow }]} />
          <Text style={styles.statTitle}>HEADS</Text>
          <Text style={styles.statValue}>{headsCount}</Text>
        </View>
        <View style={styles.statPill}>
          <View style={[styles.statDot, { backgroundColor: Colors.orange }]} />
          <Text style={styles.statTitle}>TAILS</Text>
          <Text style={styles.statValue}>{tailsCount}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable 
          onPress={resetStats} 
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && { opacity: 0.7 },
            (headsCount === 0 && tailsCount === 0) && { opacity: 0.5 }
          ]}
          disabled={headsCount === 0 && tailsCount === 0}
        >
          <IconSymbol name="arrow.counterclockwise" size={16} color="white" weight="bold" />
        </Pressable>
      </View>

      {/* Count Selector */}
      <View style={styles.countSelector}>
        {[1, 2].map(n => {
          const isSelected = coinCount === n;
          return (
            <Pressable
              key={n}
              onPress={() => handleCoinCountChange(n)}
              style={[
                styles.countBtn,
                isSelected ? styles.countBtnSelected : styles.countBtnUnselected
              ]}
              disabled={isFlipping}
            >
              <Text style={[
                styles.countBtnText,
                isSelected ? styles.countBtnTextSelected : styles.countBtnTextUnselected
              ]}>
                {n} {n === 1 ? "Coin" : "Coins"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* Result Label */}
      <View style={[styles.resultContainer, isFlipping && { opacity: 0.4 }]}>
        <Text style={styles.resultHeader}>{hasResult ? "RESULT" : "READY"}</Text>
        <Text style={[
          styles.resultText,
          hasResult ? { color: Colors.yellow, textShadowColor: 'rgba(255, 214, 10, 0.5)', textShadowRadius: 16, textShadowOffset: { width: 0, height: 4 } } : {}
        ]}>
          {getResultText()}
        </Text>
      </View>

      {/* Coins Row */}
      <View style={styles.coinsRow}>
        {Array.from({ length: coinCount }).map((_, i) => (
          <CoinComponent
            key={i}
            rotationSV={coinStates[i].rotation}
            size={coinSize}
            isFlipping={isFlipping}
            onPress={() => {
              if (!isFlipping) flip();
            }}
          />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Flip Button */}
      <Pressable
        onPress={flip}
        disabled={isFlipping}
        style={({ pressed }) => [
          styles.flipButtonContainer,
          pressed && { opacity: 0.8 },
          isFlipping && { opacity: 0.6 }
        ]}
      >
        <LinearGradient
          colors={[Colors.yellow, Colors.orange]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.flipButton}
        >
          <IconSymbol name="arrow.triangle.2.circlepath" size={20} color="black" weight="heavy" />
          <Text style={styles.flipButtonText}>
            {isFlipping ? "Flipping..." : (coinCount === 1 ? "Flip Coin" : "Flip Coins")}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.6)',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: 'white',
    fontVariant: ['tabular-nums'],
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  countBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  countBtnSelected: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  countBtnUnselected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  countBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  countBtnTextSelected: {
    color: 'black',
  },
  countBtnTextUnselected: {
    color: 'white',
  },
  resultContainer: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  resultHeader: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.55)',
  },
  resultText: {
    fontSize: 34,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  coinsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  coinContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 20,
  },
  coinImage: {
    width: '100%',
    height: '100%',
  },
  flipButtonContainer: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 999,
    shadowColor: Colors.yellow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  flipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    gap: 10,
  },
  flipButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '900',
  },
});
