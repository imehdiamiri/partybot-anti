import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, SharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioManager } from '@/src/services/AudioManager';

const { width } = Dimensions.get('window');

const getPipPositions = (value: number) => {
  const tl = { x: 0.22, y: 0.22 };
  const tr = { x: 0.78, y: 0.22 };
  const ml = { x: 0.22, y: 0.5 };
  const mc = { x: 0.5, y: 0.5 };
  const mr = { x: 0.78, y: 0.5 };
  const bl = { x: 0.22, y: 0.78 };
  const br = { x: 0.78, y: 0.78 };

  switch (value) {
    case 1: return [mc];
    case 2: return [tl, br];
    case 3: return [tl, mc, br];
    case 4: return [tl, tr, bl, br];
    case 5: return [tl, tr, mc, bl, br];
    case 6: return [tl, tr, ml, mr, bl, br];
    default: return [mc];
  }
};

const Die2DView = ({ value, size, shake, index }: { value: number; size: number; shake: SharedValue<number>; index: number }) => {
  const pips = getPipPositions(value);
  const dotSize = size * 0.26;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${shake.value * (index % 2 === 0 ? 1 : -1)}deg` }
      ]
    };
  });

  return (
    <Animated.View style={[
      { width: size, height: size, shadowColor: 'black', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 12 },
      animatedStyle
    ]}>
      <LinearGradient
        colors={[Colors.white, '#e0e0e0']}
        style={[StyleSheet.absoluteFill, { borderRadius: size * 0.18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.7)', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: size * 0.18 }]}
      />
      <View style={{ ...StyleSheet.absoluteFillObject }}>
        {pips.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: Colors.blue,
              left: p.x * size - dotSize / 2,
              top: p.y * size - dotSize / 2,
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
};

export default function DiceToolScreen() {
  const [count, setCount] = useState(1);
  const [values, setValues] = useState([1]);
  const [isRolling, setIsRolling] = useState(false);

  const shakeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    syncValues(count);
  }, []);

  const syncValues = (newCount: number) => {
    let newVals = [...values];
    while (newVals.length < newCount) {
      newVals.push(Math.floor(Math.random() * 6) + 1);
    }
    if (newVals.length > newCount) {
      newVals = newVals.slice(0, newCount);
    }
    setValues(newVals);
    setCount(newCount);
  };

  const roll = () => {
    if (isRolling) return;
    setIsRolling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    AudioManager.play('tileFlip');
    scaleAnim.value = withSpring(0.95, { damping: 10, stiffness: 100 });

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      shakeAnim.value = Math.random() * 36 - 18;
      setValues(prev => prev.map(() => Math.floor(Math.random() * 6) + 1));
      
      if (ticks >= 10) {
        clearInterval(interval);
        shakeAnim.value = withSpring(0);
        scaleAnim.value = withSpring(1);
        setIsRolling(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AudioManager.play('success');
      }
    }, 70);
  };

  const total = values.reduce((a, b) => a + b, 0);

  const columns = count > 2 ? 2 : count;
  const side = count === 1 ? 220 : (count === 2 ? 140 : 120);

  const mainAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleAnim.value }],
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 20,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.countSelector}>
        {[1, 2, 3, 4].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              AudioManager.play('buttonTap');
              syncValues(n);
            }}
            disabled={isRolling}
            style={[styles.countButton, count === n ? styles.countButtonActive : styles.countButtonInactive]}
          >
            <Text style={[styles.countText, count === n ? styles.countTextActive : styles.countTextInactive]}>
              {n} {n === 1 ? 'Die' : 'Dice'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.middleArea}>
        <Animated.View style={[mainAnimatedStyle, count === 4 && { width: 260 }]}>
          {values.map((v, i) => (
            <Die2DView key={i} index={i} value={v} size={side} shake={shakeAnim} />
          ))}
        </Animated.View>
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{count === 1 ? 'VALUE' : 'TOTAL'}</Text>
          <Text style={[styles.totalValue, isRolling && { opacity: 0.35 }]}>{total}</Text>
        </View>

        <TouchableOpacity onPress={roll} disabled={isRolling} activeOpacity={0.8} style={{ width: '100%', paddingHorizontal: 20, paddingBottom: 28 }}>
          <LinearGradient colors={[Colors.blue, Colors.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rollButton}>
            <IconSymbol name="dice.fill" size={18} color="white" weight="heavy" />
            <Text style={styles.rollButtonText}>{isRolling ? 'Rolling...' : 'Roll'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  countSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  countButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  countButtonActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  countButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  countText: {
    fontSize: 13,
    fontWeight: '900',
  },
  countTextActive: {
    color: 'black',
  },
  countTextInactive: {
    color: 'white',
  },
  middleArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomArea: {
    alignItems: 'center',
  },
  totalContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  totalValue: {
    fontSize: 96,
    fontWeight: '900',
    color: Colors.blue,
    textShadowColor: 'rgba(10, 132, 255, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  rollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 30,
  },
  rollButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
});
