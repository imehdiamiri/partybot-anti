import { Colors } from '@/src/theme/Colors';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Keyboard,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { CurrentTurnPill, BeerBottleView } from '@/src/components/games/SharedGameComponents';
import { AudioManager } from '@/src/services/AudioManager';
import { FriendSuggestions } from '@/src/components/FriendSuggestions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Safe haptics wrapper — web doesn't support haptics
const safeHaptic = {
  selection: () => { try { Haptics.selectionAsync(); } catch {} },
  impact: () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} },
  success: () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} },
};

// ─── Main Component ───

export default function BottleToolScreen() {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const bottleAngle = useSharedValue(0);

  const addName = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setNames(prev => [...prev, trimmed]);
    setDraft('');
    safeHaptic.selection();
    Keyboard.dismiss();
  }, [draft]);

  const removeName = useCallback((index: number) => {
    setNames(prev => prev.filter((_, i) => i !== index));
    setSelectedIndex(prev => prev === index ? null : prev);
  }, []);

  const onSpinDone = useCallback((target: number, hasNames: boolean) => {
    if (hasNames) setSelectedIndex(target);
    setIsSpinning(false);
    safeHaptic.success();
    AudioManager.play('success');
  }, []);

  const spin = useCallback(() => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSelectedIndex(null);
    safeHaptic.impact();
    AudioManager.play('bottleSpin');

    const hasNames = names.length > 0;
    const target = hasNames ? Math.floor(Math.random() * names.length) : 0;
    const perSlice = hasNames ? 360 / names.length : 0;
    const baseRotations = (Math.floor(Math.random() * 5) + 10) * 360;
    const targetAngle = perSlice * target;
    const jitter = hasNames
      ? Math.random() * perSlice * 0.5 - perSlice * 0.25
      : Math.random() * 360;

    const normalized = bottleAngle.value % 360;
    const nextAngle = bottleAngle.value - normalized + baseRotations + targetAngle + jitter;

    bottleAngle.value = withTiming(nextAngle, {
      duration: 8000,
      easing: Easing.bezier(0.15, 0.45, 0.2, 1.0),
    });

    setTimeout(() => onSpinDone(target, hasNames), 8050);
  }, [isSpinning, names.length, bottleAngle, onSpinDone]);

  const bottleSize = Math.min(SCREEN_WIDTH * 0.85, 360);
  const radius = bottleSize / 2 - 44;

  const bottleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bottleAngle.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <View style={styles.content}>
        {/* Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a name"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addName}
          returnKeyType="done"
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={[styles.addButton, !draft.trim() && { opacity: 0.4 }]}
          onPress={addName}
          disabled={!draft.trim()}
          activeOpacity={0.7}
        >
          <IconSymbol name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Friend Suggestions */}
      <FriendSuggestions
        existingNames={names}
        onSelectFriend={(name) => {
          setNames(prev => [...prev, name]);
          safeHaptic.selection();
        }}
      />

      {/* Name Chips */}
      {names.length > 0 && (
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {names.map((name, i) => (
              <View key={`${name}-${i}`} style={[
                styles.chip,
                selectedIndex === i && styles.chipSelected,
              ]}>
                <Text style={[
                  styles.chipText,
                  selectedIndex === i && styles.chipTextSelected,
                ]}>{name}</Text>
                <TouchableOpacity
                  onPress={() => removeName(i)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="xmark" size={9} color={selectedIndex === i ? '#fff' : 'rgba(255,255,255,0.5)'} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Spin Area */}
      <View style={styles.spinArea}>
        <View style={[styles.wheelContainer, { width: bottleSize, height: bottleSize }]}>
          {/* Name Ring */}
          {names.length > 0 && names.map((name, index) => {
            const angle = (360 / names.length) * index - 90;
            const radians = (angle * Math.PI) / 180;
            const x = Math.cos(radians) * radius;
            const y = Math.sin(radians) * radius;
            const isSelected = selectedIndex === index;

            return (
              <Animated.View
                key={`ring-${index}`}
                style={[
                  styles.namePositioner,
                  { transform: [{ translateX: x }, { translateY: y }] },
                ]}
              >
                {isSelected ? (
                  <CurrentTurnPill playerName={name} accent={Colors.green} />
                ) : (
                  <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
                )}
              </Animated.View>
            );
          })}

          {/* Bottle */}
          <Animated.View style={[styles.bottleWrapper, bottleAnimatedStyle]}>
            <BeerBottleView width={bottleSize * 0.45} />
          </Animated.View>
        </View>
      </View>

      {/* Empty hint */}
      {names.length === 0 && (
        <Text style={styles.emptyText}>Add names to spin the bottle</Text>
      )}

      {/* Spin Button */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          onPress={spin}
          disabled={isSpinning}
          activeOpacity={0.8}
          style={[styles.spinButtonWrapper, isSpinning && { opacity: 0.6 }]}
        >
          <LinearGradient
            colors={['#FF2D55', '#AF52DE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.spinButton}
          >
            <IconSymbol name="arrow.triangle.2.circlepath" size={18} color="white" />
            <Text style={styles.spinButtonText}>
              {isSpinning ? 'Spinning...' : 'Spin'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FF2D55',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsContainer: {
    marginTop: 12,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  chipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#fff',
  },
  spinArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.08)',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
  },
  namePositioner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
  },
  nameText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottleWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  spinButtonWrapper: {
    width: '100%',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 30,
  },
  spinButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
});
