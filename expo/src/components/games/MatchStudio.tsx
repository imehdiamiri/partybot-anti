import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CompactGameContext } from './GameControls';
import { GameDesign as D } from '@/src/theme/GameDesign';

export function MatchStudio({ kind, step, player, round, children, scrollEnabled = true }: {
  kind: 'color' | 'sound'; step: 0 | 1 | 2; player: string; round: string; children: React.ReactNode; scrollEnabled?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const [height, setHeight] = useState(600);
  const compact = height < 500;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const label = step === 0 ? (kind === 'color' ? 'Remember the color' : 'Listen to the tone') : step === 1 ? 'Make your match' : 'Your result';
  return <ScrollView ref={scroll} onLayout={e => setHeight(e.nativeEvent.layout.height)} scrollEnabled={scrollEnabled}
    bounces={false} contentInsetAdjustmentBehavior="never" style={{ flex: 1, backgroundColor: D.background }}
    contentContainerStyle={{ padding: compact ? 8 : 16, paddingTop: compact ? 8 : 24, paddingBottom: compact ? 8 : 24 }}>
    <CompactGameContext.Provider value={compact}>
      <View testID={`${kind}-match-studio`} style={{ width: '100%', maxWidth: D.contentWidth, alignSelf: 'center', gap: compact ? 8 : 20 }}>
        {!(compact && step === 1) && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text style={{ color: D.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
          <Text style={{ color: D.muted, fontSize: 12 }}>Round {round}</Text>
        </View>}
        {step === 1 ? children : <View style={{ borderRadius: D.radius, padding: compact ? 12 : 20, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border }}>{children}</View>}
      </View>
    </CompactGameContext.Provider>
  </ScrollView>;
}
