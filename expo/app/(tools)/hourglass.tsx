import { Colors } from '@/src/theme/Colors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  SharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioManager } from '@/src/services/AudioManager';

// Using the same single static hourglass image as the iOS version
const HOURGLASS_IMG = require('@/assets/images/tools/hourglass.png');

const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1min", seconds: 60 },
  { label: "2min", seconds: 120 },
  { label: "5min", seconds: 300 },
  { label: "10min", seconds: 600 }
];

const playClick = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); AudioManager.play('buttonTap'); };
const playTimerStart = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); AudioManager.play('success'); };
const playTimerStop = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); AudioManager.play('phaseChange'); };
const playCountdownTick = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); AudioManager.play('countdown'); };
const playGameEnd = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); AudioManager.play('gameOver'); };

// --- Custom Wheel Picker ---
const ITEM_HEIGHT = 44;
const WheelPicker = ({ title, value, range, onChange }: { title: string, value: number, range: number[], onChange: (v: number) => void }) => {
  return (
    <View style={styles.wheelContainer}>
      <Text style={styles.wheelTitle}>{title}</Text>
      <ScrollView
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (range[idx] !== undefined) {
            onChange(range[idx]);
          }
        }}
      >
        {range.map(v => {
          const isSelected = value === v;
          return (
            <View key={v} style={styles.wheelItem}>
              <Text style={[styles.wheelItemText, !isSelected && { color: 'rgba(255,255,255,0.3)' }]}>
                {v.toString().padStart(2, '0')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default function HourglassToolScreen() {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);

  const totalSet = Math.max(1, minutes * 60 + seconds);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  const progressSV = useSharedValue(1);
  const scaleSV = useSharedValue(1);

  useEffect(() => {
    if (isAlarming) {
      scaleSV.value = withRepeat(withSpring(1.05, { damping: 10, stiffness: 100 }), -1, true);
    } else {
      scaleSV.value = withSpring(1.0);
    }
  }, [isAlarming]);

  useEffect(() => {
    if (!isRunning && !isPaused) {
      setRemaining(totalSet);
      progressSV.value = 1;
    }
  }, [minutes, seconds, totalSet, isRunning, isPaused]);

  useEffect(() => {
    if (isRunning && !isPaused) {
      // Smooth visual sand fall
      progressSV.value = withTiming(0, {
        duration: remainingRef.current * 1000,
        easing: Easing.linear
      });
    } else {
      progressSV.value = totalSet > 0 ? remainingRef.current / totalSet : 0;
    }
  }, [isRunning, isPaused, totalSet]);

  const triggerAlarm = () => {
    setIsRunning(false);
    setIsAlarming(true);
    playGameEnd();
    
    // Simulate iOS alarm sound pulses
    let pulses = 0;
    const pulseInterval = setInterval(() => {
      pulses++;
      if (pulses > 8 || !isAlarming) {
        clearInterval(pulseInterval);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }, 600);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        if (remainingRef.current > 0) {
          const newRemaining = remainingRef.current - 1;
          setRemaining(newRemaining);
          if (newRemaining <= 3 && newRemaining > 0) {
            playCountdownTick();
          }
          if (newRemaining === 0) {
            triggerAlarm();
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const start = () => {
    setRemaining(totalSet);
    setIsRunning(true);
    setIsPaused(false);
    playTimerStart();
  };

  const pause = () => {
    setIsRunning(false);
    setIsPaused(true);
    playClick();
  };

  const resume = () => {
    setIsRunning(true);
    setIsPaused(false);
    playClick();
  };

  const cancel = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRemaining(totalSet);
    playTimerStop();
  };

  const stopAlarm = () => {
    setIsAlarming(false);
    setRemaining(totalSet);
    playClick();
  };

  const setPreset = (secs: number) => {
    playClick();
    setMinutes(Math.floor(secs / 60));
    setSeconds(secs % 60);
  };

  const isPresetActive = (secs: number) => (minutes * 60 + seconds) === secs;

  const timeString = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  
  const minRange = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const secRange = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSV.value }]
  }));

  return (
    <View style={styles.container}>
      {/* Configuration */}
      {!isRunning && !isPaused && !isAlarming && (
        <View style={styles.configSection}>
          <View style={styles.pickersRow}>
            <WheelPicker title="MIN" value={minutes} range={minRange} onChange={setMinutes} />
            <Text style={styles.colon}>:</Text>
            <WheelPicker title="SEC" value={seconds} range={secRange} onChange={setSeconds} />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
            {PRESETS.map(preset => {
              const active = isPresetActive(preset.seconds);
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => setPreset(preset.seconds)}
                  style={[styles.presetBtn, active ? styles.presetBtnActive : styles.presetBtnInactive]}
                >
                  <Text style={[styles.presetText, active ? styles.presetTextActive : styles.presetTextInactive]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ flex: 1 }} />

      {/* Timer Display */}
      <Animated.View style={[styles.timerDisplay, animatedContainerStyle]}>
        <Text style={[styles.timeText, isAlarming ? { color: Colors.red } : { color: '#007AFF' }]}>
          {timeString}
        </Text>

        <View style={styles.hourglassWrapper}>
          <Image 
            source={HOURGLASS_IMG} 
            style={{ width: '100%', height: '100%' }} 
            contentFit="contain" 
          />
        </View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Controls */}
      <View style={styles.controlsRow}>
        {isAlarming ? (
          <ControlButton title="Stop" icon="stop.fill" colors={[Colors.red, Colors.orange]} onPress={stopAlarm} />
        ) : isRunning ? (
          <>
            <ControlButton title="Pause" icon="pause.fill" colors={[Colors.orange, Colors.yellow]} onPress={pause} />
            <ControlButton title="Cancel" icon="xmark" colors={['#8E8E93', 'rgba(142, 142, 147, 0.7)']} onPress={cancel} />
          </>
        ) : isPaused ? (
          <>
            <ControlButton title="Resume" icon="play.fill" colors={[Colors.cyan, '#007AFF']} onPress={resume} />
            <ControlButton title="Cancel" icon="xmark" colors={['#8E8E93', 'rgba(142, 142, 147, 0.7)']} onPress={cancel} />
          </>
        ) : (
          <ControlButton title="Start" icon="play.fill" colors={[Colors.cyan, '#007AFF']} onPress={start} disabled={totalSet === 0} />
        )}
      </View>
    </View>
  );
}

const ControlButton = ({ title, icon, colors, onPress, disabled }: { title: string, icon: any, colors: readonly [string, string], onPress: () => void, disabled?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.controlBtnWrapper,
      { flex: 1 },
      pressed && { opacity: 0.8 },
      disabled && { opacity: 0.5 }
    ]}
  >
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.controlBtn}>
      <IconSymbol name={icon} size={16} color="white" weight="heavy" />
      <Text style={styles.controlBtnText}>{title}</Text>
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  configSection: {
    gap: 16,
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  colon: {
    fontSize: 34,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.5)',
  },
  wheelContainer: {
    width: 100,
    height: 130,
    alignItems: 'center',
  },
  wheelTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 34,
    fontWeight: '900',
    color: 'white',
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetBtnActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  presetBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '900',
  },
  presetTextActive: {
    color: 'black',
  },
  presetTextInactive: {
    color: 'white',
  },
  timerDisplay: {
    alignItems: 'center',
    gap: 16,
  },
  timeText: {
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  hourglassWrapper: {
    width: 160,
    height: 220,
  },
  hourglassShadow: {
    position: 'absolute',
    bottom: -10,
    width: 120,
    height: 20,
    borderRadius: 60,
    backgroundColor: 'rgba(50, 173, 230, 0.25)',
    alignSelf: 'center',
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
    zIndex: -1,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  controlBtnWrapper: {
    borderRadius: 999,
    shadowColor: 'black', // Handled partially by LinearGradient on iOS, but let's add simple shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    gap: 10,
  },
  controlBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
});
