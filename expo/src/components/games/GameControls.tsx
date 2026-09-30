import React, { createContext, useContext, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSliderDrag } from '@/src/hooks/useSliderDrag';
import { GameDesign as D } from '@/src/theme/GameDesign';
import { webSliderGestureStyle } from '@/src/theme/webGestureStyle';

export const CompactGameContext = createContext(false);
export const useCompactGame = () => useContext(CompactGameContext);

export function GameControlCard({ children }: { children: React.ReactNode }) {
  const compact = useCompactGame();
  return <View style={[s.card, { padding: compact ? 6 : 12, gap: compact ? 0 : 8 }]}>{children}</View>;
}

export function GameActionButton({ onPress, testID, label = 'Submit Match' }: { onPress: () => void; testID: string; label?: string }) {
  const compact = useCompactGame();
  return <Pressable accessibilityRole="button" testID={testID} onPress={onPress}
    style={({ pressed }) => [s.action, { minHeight: compact ? 48 : 52, opacity: pressed ? .8 : 1 }]}>
    <Text style={s.actionText}>{label}</Text><Text style={s.actionText} accessible={false}>→</Text>
  </Pressable>;
}

export function GameSlider({ label, value, min, max, onChange, onComplete, onDraggingChange, formatValue,
  renderTrack, thumbColor, testID }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void;
  onComplete?: (value: number) => void; onDraggingChange: (value: boolean) => void;
  formatValue: (value: number) => string; renderTrack: () => React.ReactNode; thumbColor: string; testID: string;
}) {
  const compact = useCompactGame();
  const [width, setWidth] = useState(1);
  const responders = useSliderDrag({ axis: 'x', length: width, value, min, max, onChange, onComplete, onDraggingChange });
  return <View style={[s.slider, compact && s.sliderCompact]}>
    <View style={[s.labelRow, compact && s.labelCompact]}>
      <Text style={s.label}>{label}</Text>
      {!compact && <Text style={s.value}>{formatValue(value)}</Text>}
    </View>
    <View style={{ flex: compact ? 1 : undefined, marginHorizontal: 16 }}>
      <View testID={testID} onLayout={e => setWidth(e.nativeEvent.layout.width)} {...responders}
        accessibilityRole="adjustable" role="slider" accessibilityLabel={label}
        accessibilityValue={{ min, max, now: Math.round(value) }}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => onChange(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        {...(Platform.OS === 'web' ? { tabIndex: 0, onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
          if (!direction && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const next = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, value + direction));
          onChange(next); onComplete?.(next);
        } } : {})}
        style={s.trackTouch}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>{renderTrack()}</View>
        <View pointerEvents="none" style={[s.thumb, { left: `${(value - min) / (max - min) * 100}%` }]}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: thumbColor }} />
        </View>
      </View>
    </View>
    {compact && <Text style={[s.value, { width: 38, textAlign: 'right', fontSize: 12 }]}>{formatValue(value)}</Text>}
  </View>;
}

export function MatchPreview({ color, frequency, onPlay, playing = false }: { color?: string; frequency?: number; onPlay?: () => void; playing?: boolean }) {
  const compact = useCompactGame();
  if (color) return <View style={[s.preview, { flexDirection: 'column', alignItems: 'stretch', padding: compact ? 8 : 12, gap: 8 }]}>
    <View testID="color-match-guess-swatch" style={{ width: '100%', height: compact ? 72 : 144, borderRadius: 14, backgroundColor: color, borderWidth: 1, borderColor: '#FFFFFF33' }} />
    <Text style={[s.previewLabel, { fontSize: compact ? 13 : 14 }]}>Your color</Text>
  </View>;
  return <View style={[s.preview, { padding: compact ? 4 : 16, minHeight: compact ? 52 : 96 }]}>
    <View testID="sound-match-freq-circle"><Text style={[s.frequency, { fontSize: compact ? 28 : 40 }]}>{frequency}<Text style={{ fontSize: 14, color: D.muted }}> Hz</Text></Text></View>
    <View style={{ flex: 1, gap: 4 }}><Text style={s.previewLabel}>Your tone</Text>
      {!compact && <Text style={{ color: D.muted, fontSize: 13 }}>Listen and fine-tune</Text>}
    </View>
    {onPlay && <Pressable testID="sound-match-play-guess-button" accessibilityRole="button" accessibilityLabel="Play your tone for 3 seconds" onPress={onPlay}
      style={({ pressed }) => [s.play, { opacity: pressed ? .7 : 1 }]}><Text style={{ color: D.text, fontSize: 18 }}>{playing ? '♫' : '▶'}</Text></Pressable>}
  </View>;
}

const s = StyleSheet.create({
  card: { borderRadius: D.radius, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: D.radius, backgroundColor: '#20283A', borderWidth: 1, borderColor: '#3A4862' },
  previewLabel: { color: D.text, fontSize: 16, fontWeight: '700' },
  frequency: { color: '#83E7D2', fontWeight: '700', fontVariant: ['tabular-nums'] },
  play: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#34445C' },
  action: { backgroundColor: D.primary, borderRadius: D.buttonRadius, paddingHorizontal: 20, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  slider: { width: '100%', paddingVertical: 0 },
  sliderCompact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  labelCompact: { width: 72, paddingHorizontal: 0 },
  label: { color: D.text, fontSize: 13, fontWeight: '600' },
  value: { color: D.muted, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  trackTouch: { height: D.touchSize, justifyContent: 'center', ...webSliderGestureStyle },
  thumb: { position: 'absolute', top: 6, width: 32, height: 32, marginLeft: -16, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6DDE8' },
});
