import { Colors } from '@/src/theme/Colors';
import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
  useAnimatedReaction,
  interpolateColor,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioManager } from '@/src/services/AudioManager';

const SLICE_COLORS = [
  Colors.orange,
  Colors.cyan,
  '#FF2D55',
  Colors.green,
  '#AF52DE',
  Colors.yellow,
  Colors.blue,
  '#FF6B35',
  '#34C759',
  '#5AC8FA',
  '#FF9500',
  '#BF5AF2',
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 24;
const MAX_LABEL_LEN = 24;

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (cx: number, cy: number, r: number, startA: number, endA: number) => {
  const start = polarToCartesian(cx, cy, r, endA);
  const end = polarToCartesian(cx, cy, r, startA);
  const largeArc = endA - startA <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
};

const fitLabel = (label: string, sliceCount: number) => {
  const max = sliceCount > 16 ? 6 : sliceCount > 10 ? 9 : sliceCount > 6 ? 14 : MAX_LABEL_LEN;
  if (label.length <= max) return label;
  return label.slice(0, Math.max(1, max - 1)) + '…';
};

export default function WheelToolScreen() {
  const screenW = Dimensions.get('window').width;
  const wheelSize = Math.min(screenW - 40, 360);
  const radius = wheelSize / 2;

  const [options, setOptions] = useState<string[]>(['Truth', 'Dare']);
  const [draft, setDraft] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [removeAfterSpin, setRemoveAfterSpin] = useState<boolean>(false);

  const rotation = useSharedValue<number>(0);
  const pointerColorIndex = useSharedValue<number>(-1);
  const inputRef = useRef<TextInput>(null);
  const tensionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sliceAngle = options.length > 0 ? 360 / options.length : 360;

  const slices = useMemo(() => {
    return options.map((label, i) => {
      const startA = i * sliceAngle;
      const endA = (i + 1) * sliceAngle;
      const midA = (startA + endA) / 2;
      const color = SLICE_COLORS[i % SLICE_COLORS.length];
      return { label, startA, endA, midA, color, index: i };
    });
  }, [options, sliceAngle]);

  const addOption = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LABEL_LEN) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Too long', `Keep entries under ${MAX_LABEL_LEN} characters.`);
      return;
    }
    if (options.length >= MAX_OPTIONS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Maximum reached', `You can have up to ${MAX_OPTIONS} options.`);
      return;
    }
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Duplicate', `"${trimmed}" is already on the wheel.`);
      return;
    }
    setOptions([...options, trimmed]);
    setDraft('');
    setWinner(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Need at least 2', 'A wheel needs at least 2 options to spin.');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
    setWinner(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSpinComplete = (finalRotation: number) => {
    setIsSpinning(false);
    const normalized = ((finalRotation % 360) + 360) % 360;
    // Pointer is at the top (12 o'clock = -90 deg from rotation 0).
    // Wheel rotates clockwise by `normalized`. The slice currently at the top
    // is the one whose midA (in original wheel coords) equals (360 - normalized) mod 360.
    const pointerAngle = (360 - normalized) % 360;
    const winnerIndex = Math.floor(pointerAngle / sliceAngle) % options.length;
    const result = options[winnerIndex] ?? options[0];
    setWinner(result);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AudioManager.play('wheelWin');
    if (removeAfterSpin && options.length > MIN_OPTIONS) {
      setTimeout(() => {
        setOptions((prev) => prev.filter((_, i) => i !== winnerIndex));
      }, 1200);
    }
  };

  const onPointerTick = () => {
    Haptics.selectionAsync();
  };

  const spin = () => {
    if (isSpinning || options.length < MIN_OPTIONS) return;
    Keyboard.dismiss();
    setWinner(null);
    setIsSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    AudioManager.play('wheelSpin');

    cancelAnimation(rotation);
    if (tensionTimerRef.current) {
      clearTimeout(tensionTimerRef.current);
      tensionTimerRef.current = null;
    }

    // Single 10s spin: starts fast and gently eases into a near-still stop.
    // bezier(0.05, 0.7, 0.1, 1) front-loads the velocity then trails off slowly
    // for maximum suspense at the end.
    const totalDuration = 10000;
    const totalTurns = 8 + Math.random() * 3; // 8..11 full rotations across the spin
    const extraAngle = Math.random() * 360; // random landing offset
    const finalTarget = rotation.value + totalTurns * 360 + extraAngle;

    // Tension cue ~2s before stop, when slices visibly crawl.
    tensionTimerRef.current = setTimeout(() => {
      AudioManager.play('phaseChange');
    }, totalDuration - 2000);

    rotation.value = withTiming(
      finalTarget,
      {
        duration: totalDuration,
        easing: Easing.bezier(0.05, 0.7, 0.1, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(onSpinComplete)(finalTarget);
        }
      },
    );
  };

  const wheelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Sample which slice is under the pointer on the UI thread; bridge only when it changes.
  useAnimatedReaction(
    () => {
      const normalized = ((rotation.value % 360) + 360) % 360;
      const pointerAngle = (360 - normalized) % 360;
      return Math.floor(pointerAngle / sliceAngle) % Math.max(1, options.length);
    },
    (idx, prev) => {
      if (idx !== prev) {
        pointerColorIndex.value = idx;
        runOnJS(onPointerTick)();
      }
    },
    [sliceAngle, options.length],
  );

  const pointerTipAnimatedStyle = useAnimatedStyle(() => {
    const i = pointerColorIndex.value;
    if (i < 0 || i >= slices.length) {
      return { borderTopColor: 'white' as const };
    }
    const color = interpolateColor(
      i,
      [i - 0.0001, i],
      [slices[i].color, slices[i].color],
    );
    return { borderTopColor: color };
  });

  const pointerBodyAnimatedStyle = useAnimatedStyle(() => {
    const i = pointerColorIndex.value;
    if (i < 0 || i >= slices.length) {
      return { backgroundColor: 'white' as const };
    }
    const color = interpolateColor(
      i,
      [i - 0.0001, i],
      [slices[i].color, slices[i].color],
    );
    return { backgroundColor: color };
  });

  const fontSize = options.length > 16 ? 9 : options.length > 10 ? 11 : options.length > 6 ? 12 : 14;
  const labelRadius = radius * 0.62;

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {/* Wheel */}
      <View style={styles.wheelArea}>
        <View style={[styles.wheelWrap, { width: wheelSize, height: wheelSize }]}>
          <Animated.View style={[{ width: wheelSize, height: wheelSize }, wheelAnimatedStyle]}>
            <Svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${wheelSize} ${wheelSize}`}>
              <Defs>
                <RadialGradient id="sheen" cx="50%" cy="50%" r="55%">
                  <Stop offset="0%" stopColor="white" stopOpacity={0.22} />
                  <Stop offset="55%" stopColor="white" stopOpacity={0.04} />
                  <Stop offset="100%" stopColor="black" stopOpacity={0.18} />
                </RadialGradient>
                <RadialGradient id="rim" cx="50%" cy="50%" r="50%">
                  <Stop offset="88%" stopColor="#1B1D24" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#0A0B0F" stopOpacity={1} />
                </RadialGradient>
              </Defs>
              <G>
                {/* outer dark rim */}
                <Circle cx={radius} cy={radius} r={radius - 1} fill="url(#rim)" />
                {slices.map((s) => (
                  <Path
                    key={s.index}
                    d={arcPath(radius, radius, radius - 14, s.startA, s.endA)}
                    fill={s.color}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={1.2}
                  />
                ))}
                {/* sheen overlay over slices */}
                <Circle cx={radius} cy={radius} r={radius - 14} fill="url(#sheen)" />
                {/* labels */}
                {slices.map((s) => {
                  const pos = polarToCartesian(radius, radius, labelRadius, s.midA);
                  return (
                    <SvgText
                      key={`l-${s.index}`}
                      x={pos.x}
                      y={pos.y}
                      fill="white"
                      fontSize={fontSize}
                      fontWeight="900"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      transform={`rotate(${s.midA} ${pos.x} ${pos.y})`}
                    >
                      {fitLabel(s.label, options.length)}
                    </SvgText>
                  );
                })}
                {/* inner divider ring between slices and rim */}
                <Circle
                  cx={radius}
                  cy={radius}
                  r={radius - 13}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1.5}
                  fill="none"
                />
                {/* pegs around the rim — one per slice boundary, gives the wheel its real-world look */}
                {slices.map((s) => {
                  const peg = polarToCartesian(radius, radius, radius - 7, s.startA);
                  return (
                    <Circle
                      key={`peg-${s.index}`}
                      cx={peg.x}
                      cy={peg.y}
                      r={2.5}
                      fill="#FFD66E"
                      stroke="rgba(0,0,0,0.45)"
                      strokeWidth={0.6}
                    />
                  );
                })}
                {/* outer highlight ring */}
                <Circle
                  cx={radius}
                  cy={radius}
                  r={radius - 1.5}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                  fill="none"
                />
              </G>
            </Svg>
          </Animated.View>

          {/* Center hub — fixed axle, doesn't rotate with the wheel */}
          <View style={[styles.hubOuter, { left: radius - 32, top: radius - 32 }]} pointerEvents="none">
            <LinearGradient
              colors={['#2A2D36', '#0F1014']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.hubInner}>
              <LinearGradient
                colors={['#F4F5F7', '#A8ACB7']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <IconSymbol name="sparkles" size={20} color={Colors.blue} weight="black" />
            </View>
          </View>

          {/* Pointer — marker pin: rounded body up top, sharp triangle tip pointing down into the wheel */}
          <View style={[styles.pointerWrap, { left: radius - 24 }]} pointerEvents="none">
            <Animated.View style={[styles.pointerBody, pointerBodyAnimatedStyle]}>
              <View style={styles.pointerHole} />
            </Animated.View>
            <Animated.View style={[styles.pointerTip, pointerTipAnimatedStyle]} />
          </View>
        </View>

        {/* Result */}
        <View style={styles.resultArea}>
          <Text style={styles.resultLabel}>{isSpinning ? 'SPINNING…' : winner ? 'WINNER' : 'TAP SPIN'}</Text>
          <Text style={[styles.resultValue, isSpinning && { opacity: 0.4 }]} numberOfLines={1}>
            {winner ?? '—'}
          </Text>
          <Text style={styles.hintText}>The highlighted segment at the pointer shows the winner.</Text>
        </View>
      </View>

      {/* Spin button */}
      <Pressable
        onPress={spin}
        disabled={isSpinning || options.length < MIN_OPTIONS}
        style={({ pressed }) => [
          styles.spinBtnWrap,
          pressed && { opacity: 0.85 },
          (isSpinning || options.length < MIN_OPTIONS) && { opacity: 0.55 },
        ]}
      >
        <LinearGradient
          colors={[Colors.blue, Colors.cyan]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.spinBtn}
        >
          <IconSymbol name="arrow.triangle.2.circlepath" size={18} color="white" weight="heavy" />
          <Text style={styles.spinBtnText}>{isSpinning ? 'Spinning…' : 'Spin'}</Text>
        </LinearGradient>
      </Pressable>

      {/* Remove-winner toggle */}
      <Pressable
        onPress={() => {
          setRemoveAfterSpin((v) => !v);
          Haptics.selectionAsync();
        }}
        disabled={isSpinning}
        style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.8 }]}
      >
        <View style={[styles.toggleBox, removeAfterSpin && styles.toggleBoxOn]}>
          {removeAfterSpin ? (
            <IconSymbol name="checkmark" size={12} color="white" weight="black" />
          ) : null}
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Remove winner after spin</Text>
          <Text style={styles.toggleSub}>Optionally enable to avoid repeats.</Text>
        </View>
      </Pressable>

      {/* Add option */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add an option"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={addOption}
            blurOnSubmit={false}
            maxLength={MAX_LABEL_LEN}
            editable={!isSpinning}
          />
        </View>
        <Pressable
          onPress={addOption}
          disabled={!draft.trim() || isSpinning}
          style={({ pressed }) => [
            styles.addButton,
            pressed && { opacity: 0.8 },
            (!draft.trim() || isSpinning) && { opacity: 0.5 },
          ]}
        >
          <IconSymbol name="plus" size={16} color="white" weight="black" />
        </Pressable>
      </View>

      {/* Counter */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {options.length} option{options.length === 1 ? '' : 's'}
        </Text>
        {options.length >= MAX_OPTIONS ? (
          <Text style={styles.counterMax}>Max</Text>
        ) : null}
      </View>

      {/* Chips */}
      <View style={styles.chipsWrap}>
        {options.map((opt, i) => {
          const color = SLICE_COLORS[i % SLICE_COLORS.length];
          return (
            <View
              key={`${opt}-${i}`}
              style={[styles.chip, { borderColor: `${color}66`, backgroundColor: `${color}1F` }]}
            >
              <View style={[styles.chipDot, { backgroundColor: color }]} />
              <Text style={styles.chipText} numberOfLines={1}>
                {opt}
              </Text>
              <Pressable
                onPress={() => removeOption(i)}
                disabled={isSpinning}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <IconSymbol name="xmark" size={10} color="white" weight="black" />
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  wheelArea: {
    alignItems: 'center',
    width: '100%',
  },
  wheelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  hubOuter: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  hubInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  pointerWrap: {
    position: 'absolute',
    top: -18,
    width: 48,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  pointerBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  pointerHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pointerTip: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
  },
  resultArea: {
    marginTop: 18,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  hintText: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    letterSpacing: 0.3,
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    width: '100%',
    marginBottom: 14,
  },
  toggleBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  toggleSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  resultValue: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.cyan,
    textShadowColor: 'rgba(90, 200, 250, 0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 16,
    maxWidth: 320,
    textAlign: 'center',
  },
  spinBtnWrap: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 18,
  },
  spinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 10,
  },
  spinBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  input: {
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.blue,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterRow: {
    width: '100%',
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  counterMax: {
    color: Colors.orange,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    maxWidth: 160,
  },
});
