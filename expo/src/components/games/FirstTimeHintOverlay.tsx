import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/src/utils/safeHaptics';

interface Props {
  storageKey: string;
  icon: string;
  title: string;
  tip: string;
  accent?: string;
}

/**
 * FirstTimeHintOverlay — matches iOS FirstTimeHintOverlay.swift
 * Shows once per storageKey; persists via AsyncStorage.
 * Dark backdrop, glassmorphism card, spring animation.
 */
export function FirstTimeHintOverlay({ storageKey, icon, title, tip, accent = '#007AFF' }: Props) {
  const [visible, setVisible] = useState(false);
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const key = `hint_seen_${storageKey}`;
    AsyncStorage.getItem(key).then(val => {
      if (val !== 'true') {
        setVisible(true);
        scale.value = withSpring(1, { damping: 12, stiffness: 130 });
        opacity.value = withTiming(1, { duration: 250 });
      }
    });
  }, []);

  const finishDismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(`hint_seen_${storageKey}`, 'true');
  };

  const dismiss = () => {
    Haptics.selectionAsync();
    scale.value = withSpring(0.92, { damping: 12, stiffness: 130 });
    opacity.value = withTiming(0, { duration: 200 }, (done) => {
      if (done) runOnJS(finishDismiss)();
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[st.backdrop, backdropStyle]}>
        <Pressable style={st.dismissArea} onPress={dismiss} />
        <Animated.View style={[st.card, cardStyle]}>
          {/* Icon */}
          <View style={[st.iconCircle, { backgroundColor: accent + '26' }]}>
            <IconSymbol name={icon as any} size={42} color={accent} />
          </View>

          {/* Text */}
          <Text style={st.title}>{title}</Text>
          <Text style={st.tip}>{tip}</Text>

          {/* Got it */}
          <Pressable style={[st.btn, { backgroundColor: accent }]} onPress={dismiss}>
            <Text style={st.btnTx}>Got it</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: 'rgba(40,40,45,0.95)',
    borderRadius: 24, padding: 22, width: Dimensions.get('window').width - 64,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center',
  },
  tip: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 8,
  },
  btn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', marginTop: 6,
  },
  btnTx: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
