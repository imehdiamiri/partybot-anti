import { Colors } from '@/src/theme/Colors';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastStyle = 'error' | 'success' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  style: ToastStyle;
}

const TOAST_ICONS: Record<ToastStyle, string> = {
  error: 'xmark.octagon.fill',
  success: 'checkmark.circle.fill',
  warning: 'exclamationmark.triangle.fill',
  info: 'info.circle.fill',
};

const TOAST_COLORS: Record<ToastStyle, string> = {
  error: Colors.red,
  success: Colors.green,
  warning: Colors.orange,
  info: '#007AFF',
};

// ═══ Global toast queue ═══
let toastListeners: ((toast: ToastItem) => void)[] = [];

/** Show a toast from anywhere — fire and forget */
export function showToast(message: string, style: ToastStyle = 'info') {
  const item: ToastItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    message,
    style,
  };
  toastListeners.forEach(fn => fn(item));
}

/** Convenience methods */
showToast.error = (msg: string) => showToast(msg, 'error');
showToast.success = (msg: string) => showToast(msg, 'success');
showToast.warning = (msg: string) => showToast(msg, 'warning');
showToast.info = (msg: string) => showToast(msg, 'info');

// ═══ Single toast banner ═══

function ToastBanner({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const color = TOAST_COLORS[item.style];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 4s
    const timer = setTimeout(() => dismiss(), 4000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View style={[st.banner, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
      <View style={[st.bannerInner, { borderColor: color + '4D' }]}>
        <IconSymbol name={TOAST_ICONS[item.style] as any} size={18} color={color} />
        <Text style={st.bannerText} numberOfLines={3}>{item.message}</Text>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconSymbol name="xmark" size={12} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ═══ Overlay Provider (add to root layout) ═══

/**
 * ToastOverlay — matches iOS ToastOverlay.swift
 * Place this once in the root layout. Use showToast() from anywhere.
 */
export function ToastOverlay() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts(prev => [...prev.slice(-2), toast]); // max 3 visible
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== handler);
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <View style={[st.overlay, { top: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastBanner key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, right: 0, zIndex: 9999,
    alignItems: 'center', gap: 8,
  },
  banner: {
    width: Dimensions.get('window').width - 32,
  },
  bannerInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(40,40,45,0.92)',
    borderRadius: 16, borderWidth: 1,
    // shadow
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 8,
  },
  bannerText: {
    flex: 1, color: '#fff', fontSize: 13, fontWeight: '500',
    lineHeight: 18,
  },
});
