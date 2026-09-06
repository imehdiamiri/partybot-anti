import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';

type Activity = { name: string; phase: string } | null;
const ActivityContext = createContext<{ activity: Activity; setActivity: (value: Activity) => void }>({ activity: null, setActivity: () => {} });

export function GameActivityProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<Activity>(null);
  return <ActivityContext.Provider value={{ activity, setActivity }}>{children}</ActivityContext.Provider>;
}

/** Explicit per-game turn ownership, independent of whether Skip is enabled. */
export function useGameActivity(name: string | undefined, phase: string) {
  const { setActivity } = useContext(ActivityContext);
  useEffect(() => {
    setActivity(name ? { name, phase } : null);
    return () => setActivity(null);
  }, [name, phase, setActivity]);
}

export function useNameInActivityBanner(name?: string) {
  const { activity } = useContext(ActivityContext);
  return !!name && !!activity && activity.name === name && !!activityLabel(activity.phase);
}

/** Keep standalone views usable, but do not repeat the header's turn owner. */
export function SecondaryPlayerLabel({ name, children }: { name?: string; children: React.ReactNode }) {
  return useNameInActivityBanner(name) ? null : <>{children}</>;
}

export function activityLabel(phase: string): string | null {
  if (['intro', 'difficulty', 'guide', 'loading', 'results', 'finalResults', 'finished', 'leaderboard', 'scoreboard', 'idle', 'spinning'].includes(phase)) return null;
  if (['ready', 'passToPlayer', 'guesserAnnounce', 'countdown', 'handoff'].includes(phase)) return null;
  if (['roundResult', 'roundReveal', 'playerComplete', 'result', 'outcome', 'correct', 'wrong', 'tapped', 'foul', 'complete'].includes(phase)) return null;
  if (phase === 'discussion') return 'DISCUSSING';
  if (phase === 'voting') return 'VOTING';
  return 'NOW PLAYING';
}

export function GameActivityBanner() {
  const { activity } = useContext(ActivityContext);
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(true);
  const label = activity ? activityLabel(activity.phase) : null;
  const active = !!label;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    opacity.setValue(1);
    if (!active || reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 950, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1, duration: 950, useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, opacity]);
  if (!activity || !label) return null;
  const color = '#68E8A8';
  return <View testID="game-active-player" accessibilityLiveRegion="polite" style={s.banner}>
    <Animated.View style={[s.dot, { opacity, backgroundColor: color }]} />
    <Text style={[s.label, { color: '#B6BDCA' }]}>{label}</Text>
    <Animated.Text testID="game-active-player-name" style={[s.name, { opacity: opacity.interpolate({ inputRange: [0.35, 1], outputRange: [0.72, 1] }) }]} numberOfLines={1}>{activity.name}</Animated.Text>
  </View>;
}

export const GAME_UI = StyleSheet.create({
  primaryButton: { minHeight: 56, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 36, paddingHorizontal: 12, marginTop: 6, borderRadius: 12, backgroundColor: '#191D27', borderWidth: 1, borderColor: '#303642' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  name: { flex: 1, color: '#68E8A8', fontSize: 20, fontWeight: '800' },
});
