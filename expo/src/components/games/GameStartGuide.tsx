import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/src/store/useAuthStore';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_HINTS } from '@/src/constants/GameHints';
import { getGameHint } from '@/src/constants/GameModeHints';
import { GAME_UI } from './GameActivity';

const ReplayGuide = createContext<(start: () => void) => void>(start => start());
export const useReplayGuide = () => useContext(ReplayGuide);

/** A start screen, not an overlay: no game mounts or starts its clock underneath. */
export function GameStartGuide({ gameId, onStart, config, mode }: { gameId: string; onStart: () => void; config?: Record<string, any>; mode?: string }) {
  const userId = useAuthStore(state => state.currentUser?.uid || 'guest_local');
  const historyKey = `game-guide:v1:${encodeURIComponent(userId)}:${gameId}`;
  return <RememberedGuide key={historyKey} {...{ historyKey, gameId, onStart, config, mode }} />;
}

const acknowledged = new Set<string>();
function RememberedGuide({ historyKey, gameId, onStart, config, mode }: {
  historyKey: string; gameId: string; onStart: () => void; config?: Record<string, any>; mode?: string;
}) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const startRef = useRef(onStart);
  startRef.current = onStart;
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    const read = acknowledged.has(historyKey) ? Promise.resolve('1') : AsyncStorage.getItem(historyKey);
    read.then(value => { if (active) setSeen(value === '1'); }).catch(() => { if (active) setSeen(false); });
    return () => { active = false; };
  }, [historyKey]);
  useEffect(() => {
    if (seen && !started.current) { started.current = true; startRef.current(); }
  }, [seen]);
  const hint = getGameHint(gameId, config, mode);
  if (seen !== false) return <View testID="game-guide-loading" style={{ flex: 1 }} />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.card} testID="game-start-guide">
      <IconSymbol name={hint.icon as any} size={42} color={hint.accent} />
      <Text style={s.eyebrow}>HOW TO PLAY</Text>
      <Text style={s.title}>{hint.title}</Text>
      {hint.tip.split(' | ').map((step, index) => <View key={index} style={s.step}>
        <View style={s.badge}><Text style={s.number}>{index + 1}</Text></View>
        <Text style={s.copy}>{step}</Text>
      </View>)}
      <Pressable testID="game-guide-start" accessibilityRole="button" style={[s.button, GAME_UI.primaryButton, { backgroundColor: hint.accent }]}
        onPress={() => { if (!started.current) { started.current = true; acknowledged.add(historyKey); void AsyncStorage.setItem(historyKey, '1').catch(() => {}); onStart(); } }}>
        <Text style={s.buttonText}>Got it — let’s play</Text>
      </Pressable>
    </View>
  </ScrollView>;
}

export function GameIntroGate({ gameId, children, config }: { gameId: string; children: React.ReactNode; config?: Record<string, any> }) {
  const [ready, setReady] = useState(false);
  return <ReplayGuide.Provider value={start => start()}>
    {!ready ? <GameStartGuide gameId={gameId} config={config} onStart={() => setReady(true)} /> : children}
  </ReplayGuide.Provider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#1c1c29', gap: 16, alignItems: 'center' },
  eyebrow: { color: '#aeb5c9', fontSize: 12, letterSpacing: 2 },
  title: { color: '#fff', fontSize: 23, fontWeight: '700', textAlign: 'center' },
  step: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#3b4155', alignItems: 'center', justifyContent: 'center' },
  number: { color: '#fff', fontSize: 15, fontWeight: '600' },
  copy: { flex: 1, color: '#eef0f8', fontSize: 16, lineHeight: 24 },
  button: { width: '100%', minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 8 },
  buttonText: { color: '#101018', fontSize: 17, fontWeight: '700' },
});
