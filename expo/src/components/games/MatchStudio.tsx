import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function MatchStudio({ kind, step, player, round, children, scrollEnabled = true }: {
  kind: 'color' | 'sound'; step: 0 | 1 | 2; player: string; round: string; children: React.ReactNode; scrollEnabled?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const accent = kind === 'color' ? '#B9A3FF' : '#7DE4D5';
  const labels = kind === 'color' ? ['Observe', 'Mix', 'Compare'] : ['Listen', 'Tune', 'Compare'];
  return <ScrollView ref={scroll} scrollEnabled={scrollEnabled} bounces={false} contentInsetAdjustmentBehavior="never" style={s.scroll} contentContainerStyle={s.content}>
    <View style={s.shell} testID={`${kind}-match-studio`}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: accent }]}>{kind === 'color' ? 'COLOR LAB' : 'SOUND STUDIO'}</Text>
        </View>
        <Text style={s.round}>Round {round}</Text>
      </View>
      <View style={s.steps}>{labels.map((label, i) => <View key={label} style={s.step}>
        <View style={[s.line, { backgroundColor: i <= step ? accent : '#303542' }]} />
        <Text style={[s.label, { color: i === step ? '#FFFFFF' : '#9CA5B5' }]}>{i + 1}  {label}</Text>
      </View>)}</View>
      <View style={s.surface}>{children}</View>
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0B0E16' },
  content: { flexGrow: 1, padding: 16, justifyContent: 'flex-start', paddingBottom: 28 },
  shell: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 5 },
  player: { fontSize: 22, fontWeight: '600', color: '#F4F6FA' },
  round: { color: '#BDC4D2', fontSize: 12, backgroundColor: '#1C2230', padding: 10, borderRadius: 12 },
  steps: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  step: { flex: 1, gap: 8 }, line: { height: 3, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: '600' },
  surface: { borderRadius: 24, padding: 16, backgroundColor: '#151A26', borderWidth: 1, borderColor: '#2A3040', gap: 8 },
});
