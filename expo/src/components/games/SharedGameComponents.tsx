import { Colors, Typography } from '@/src/theme/Colors';
import { useNameInActivityBanner } from './GameActivity';
import { useActionConfirmation } from '../ActionConfirmation';
import React, { useEffect, useRef } from 'react';
import { useRegisterHandoffSkip } from '@/src/contexts/GameSkipContext';
import { ResultsScoreboard } from './ResultsScoreboard';
import { View, Text, StyleSheet, Pressable, Platform, Alert, ScrollView } from 'react-native';
import { PhoneHandoffIllustration } from './GameIllustrations';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp, FadeInDown, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { Player } from '@/src/models/Player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';

import { playSharedSound } from '@/src/utils/sharedSound';
export { playSharedSound };

// Platform-safe BlurView
let BlurViewComponent: any = null;
if (Platform.OS === 'ios') {
  try { BlurViewComponent = require('expo-blur').BlurView; } catch {}
}
const SurfaceBlur = ({ style, children, intensity = 40 }: any) => {
  if (Platform.OS === 'ios' && BlurViewComponent) {
    return <BlurViewComponent intensity={intensity} tint="dark" style={style}>{children}</BlurViewComponent>;
  }
  return <View style={[style, { backgroundColor: 'rgba(30,30,40,0.85)' }]}>{children}</View>;
};

export const GamePlayerColor = {
  palette: [
    '#007AFF', Colors.green, Colors.orange, '#AF52DE', '#FF2D55', 
    Colors.cyan, '#00C7BE', Colors.yellow, Colors.red, '#5856D6', 
    '#30B0C7', '#A2845E'
  ],
  color: (index: number) => {
    return GamePlayerColor.palette[index % GamePlayerColor.palette.length];
  }
};

interface GameHandoffViewProps {
  playerName: string;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  buttonTitle?: string;
  onReady: () => void;
  onSkip?: () => void;
  rolePillText?: string;
  previousResult?: { name?: string; summary?: string };
  finalTurn?: boolean;
}

export function GameHandoffView({
  playerName, title = "Pass the phone to", subtitle, accentColor = Colors.blue,
  buttonTitle, onReady, onSkip, rolePillText = "NEXT PLAYER", previousResult, finalTurn = false,
}: GameHandoffViewProps) {
  const insets = useSafeAreaInsets();
  const registerHandoff = useRegisterHandoffSkip();
  const skipRef = useRef(onSkip);
  skipRef.current = onSkip;
  const canSkip = !!onSkip;
  useEffect(() => {
    registerHandoff(canSkip ? () => skipRef.current?.() : null, playerName);
    return () => registerHandoff(null);
  }, [canSkip, playerName, registerHandoff]);
  return <ScrollView style={{ flex: 1, backgroundColor: '#08080F' }}
    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingBottom: Math.max(20, insets.bottom + 12) }}>
    {previousResult && <View testID="previous-player-result" style={{ width: '100%', maxWidth: 480, padding: 22, marginBottom: 16, borderRadius: 22, backgroundColor: '#14251F', borderWidth: 1, borderColor: '#355E4F', gap: 10 }}>
      <Text style={{ color: '#B6C2D5', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>TURN RESULT</Text>
      {!!previousResult.name && <Text style={{ color: '#68E8A8', fontSize: 26, fontWeight: '800' }}>{previousResult.name}</Text>}
      <Text style={{ color: '#F3F6FB', fontSize: 19, lineHeight: 28 }}>{previousResult.summary || 'Turn complete'}</Text>
    </View>}
    <View testID="handoff-card" style={{ width: '100%', maxWidth: 480, alignItems: 'center', padding: 24, borderRadius: 28, backgroundColor: '#171B26', borderWidth: 1, borderColor: '#303748', gap: 20 }}>
      <Text style={{ color: accentColor, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>{rolePillText}</Text>
      {!finalTurn && <PhoneHandoffIllustration color={accentColor} />}
      {!finalTurn && <View style={{ width: '100%', gap: 8, alignItems: 'center' }}>
        <Text style={{ color: '#DCE3F0', fontSize: 22, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
        <Text testID="handoff-player-name" style={{ color: '#68E8A8', fontSize: 40, fontWeight: '800', textAlign: 'center', width: '100%' }}>{playerName}</Text>
      </View>}
      {subtitle && <Text style={{ color: '#B8C2D4', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{subtitle}</Text>}
      <Pressable testID="game-ready-button" accessibilityRole="button" onPress={onReady}
        style={({ pressed }) => ({ width: '100%', minHeight: 58, padding: 14, borderRadius: 16, backgroundColor: accentColor, opacity: pressed ? 0.8 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 })}>
        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'center' }}>{buttonTitle || "I'm Ready"}</Text>
        <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  </ScrollView>;
}

interface GamePassPhoneViewProps {
  playerName: string;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  buttonTitle?: string;
  onReady: () => void;
  onSkip?: () => void;
}

export function GamePassPhoneView({
  playerName,
  title = "Pass the phone to",
  subtitle = "Make sure no one else is looking!",
  accentColor = Colors.blue,
  buttonTitle,
  onReady,
  onSkip,
}: GamePassPhoneViewProps) {
  return (
    <GameHandoffView
      playerName={playerName}
      title={title}
      subtitle={subtitle}
      accentColor={accentColor}
      buttonTitle={buttonTitle}
      onReady={onReady}
      onSkip={onSkip}
      rolePillText="NEXT PLAYER"
    />
  );
}

export function CurrentTurnPill({ 
  playerName, 
  prefix, 
  accent = Colors.green,
  scale = 1.0 
}: { 
  playerName: string, 
  prefix?: string, 
  accent?: string,
  scale?: number 
}) {
  return (
    <View style={[styles.turnPill, { borderColor: accent, transform: [{ scale }] }]}>
      <LinearGradient colors={[`${accent}33`, 'transparent']} style={StyleSheet.absoluteFill} />
      <View style={[styles.turnPillDot, { backgroundColor: accent }]} />
      {prefix && <Text style={styles.turnPillPrefix}>{prefix}</Text>}
      <Text style={styles.turnPillName}>{playerName}</Text>
    </View>
  );
}

export function GamePlayerAvatar({ name, color = 'rgba(255,255,255,0.08)', size = 34 }: { name: string, color?: string, size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38, color: Colors.white }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  passPhoneContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  turnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  turnPillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  turnPillPrefix: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
  },
  turnPillName: {
    color: 'white',
    fontSize: 28,
    fontFamily: 'Viral-Black',
  },
  avatar: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: 'bold',
  },
});

// ─── Game Results Screen (Unified) ───
export interface GameResultData {
  playerId: string;
  score: number;
  stats: Array<{ label: string; value: string | number; color?: string }>;
  isEliminated?: boolean;
  isSkipped?: boolean;
}

interface GameResultsScreenProps {
  players: Player[];
  results: GameResultData[];
  onPlayAgain: () => void;
  title?: string;
  badgeLabel?: string;
}

export function GameResultsScreen({ players, results, onPlayAgain, title, badgeLabel = 'STANDINGS' }: GameResultsScreenProps) {
  const completed = results.filter(r => !r.isSkipped).sort((a, b) => b.score - a.score);
  const skipped = results.filter(r => r.isSkipped);
  const entries = [...completed, ...skipped].map(r => ({
    id: r.playerId,
    name: players.find(p => p.id === r.playerId)?.displayName || 'Player',
    primary: r.isSkipped ? 'Skipped' : `${r.score} pts`,
    secondary: r.stats.map(s => `${s.label}: ${s.value}`).join(' · '),
    isSkipped: !!r.isSkipped,
  }));
  return <ScrollView style={{ flex: 1, backgroundColor: '#08080F' }}
    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
    <ResultsScoreboard entries={entries} title={title || (players.length > 1 ? 'Final Rankings' : 'Complete!')}
      badgeLabel={badgeLabel} onPlayAgain={onPlayAgain} />
  </ScrollView>;
}

// ─── Game Outcome Card ───────────────────────────────────────────────────────
// Displayed briefly after a player finishes (win/lose/complete) before pass-phone.
interface GameOutcomeCardProps {
  icon: string;
  label: string;
  sublabel?: string;
  accentColor?: string;
}

export function GameOutcomeCard({ icon, label, sublabel, accentColor = Colors.green }: GameOutcomeCardProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 32 }}>
      <Animated.View entering={ZoomIn.duration(500).springify().damping(12)} style={{
        alignItems: 'center', gap: 20,
        padding: 40, borderRadius: 32,
        backgroundColor: `${accentColor}11`,
        borderWidth: 1.5, borderColor: `${accentColor}44`,
      }}>
        <View style={{
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: `${accentColor}22`,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: `${accentColor}55`,
        }}>
          <IconSymbol name={icon as any} size={52} color={accentColor} />
        </View>
        <Text style={{ color: accentColor, fontSize: 32, fontFamily: 'Viral-Black', letterSpacing: -0.5 }}>{label}</Text>
        {sublabel && (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '500', textAlign: 'center' }}>
            {sublabel}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Game Player Complete View ────────────────────────────────────────────────
// Unified "pass the phone" + score summary for multi-player turn handoffs.
interface GamePlayerCompleteViewProps {
  /** Name of the NEXT player */
  nextPlayerName: string;
  prevPlayerName?: string;
  finalTurn?: boolean;
  /** Brief result line for the PREVIOUS player, e.g. "Score: 240 · 3 hits" */
  prevResultLine?: string;
  onReady: () => void;
  accentColor?: string;
}

export function GamePlayerCompleteView({
  nextPlayerName, prevPlayerName, prevResultLine, onReady, accentColor = Colors.orange, finalTurn = false,
}: GamePlayerCompleteViewProps) {
  return (
    <GameHandoffView
      playerName={nextPlayerName}
      title="Pass the phone to"
      previousResult={{ name: prevPlayerName, summary: prevResultLine }}
      finalTurn={finalTurn}
      accentColor={accentColor}
      buttonTitle={finalTurn ? 'See Final Results' : "I'm Ready"}
      onReady={onReady}
      rolePillText={finalTurn ? 'ALL TURNS COMPLETE' : 'NEXT TURN'}
    />
  );
}

// ─── Game Ready Screen ────────────────────────────────────────────────────────
// Unified "ready" screen shown before a game or player turn starts.
interface StatBubble { label: string; value: string | number; }
interface GameReadyScreenProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  playerName?: string;
  stats?: StatBubble[];
  buttonTitle?: string;
  onStart: () => void;
  onSkip?: () => void;
}

export function GameReadyScreen({
  icon, iconColor, title, subtitle, playerName, stats, buttonTitle = 'Start', onStart, onSkip,
}: GameReadyScreenProps) {
  const nameInHeader = useNameInActivityBanner(playerName);
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Animated.View entering={ZoomIn.duration(500).springify().damping(12)}
        style={{ width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: `${iconColor}22`, borderWidth: 1, borderColor: `${iconColor}44`, marginBottom: 24 }}>
        <IconSymbol name={icon as any} size={52} color={iconColor} />
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={{ color: '#fff', fontSize: 28, fontFamily: 'Viral-Black', letterSpacing: -0.3, textAlign: 'center' }}>
        {title}
      </Animated.Text>

      <Animated.Text entering={FadeInDown.delay(180).duration(400)} style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 22 }}>
        {subtitle}
      </Animated.Text>

      {playerName && !nameInHeader && (
        <Animated.View entering={ZoomIn.delay(250).springify().damping(14)}
          style={{ backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginTop: 16, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' }}>
          <Text style={{ color: Colors.green, fontSize: 24, fontWeight: '800' }}>{playerName}</Text>
        </Animated.View>
      )}

      {stats && stats.length > 0 && (
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ flexDirection: 'row', gap: 16, marginTop: 28 }}>
          {stats.map((s, i) => (
            <View key={i} style={{ alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, minWidth: 72 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontFamily: 'Viral-Black' }}>{s.value}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(380).springify().damping(14)} style={{ width: '100%', maxWidth: 540, alignSelf: 'center', marginTop: 44 }}>
        <Pressable
          style={({ pressed }) => [{
            backgroundColor: iconColor, paddingVertical: 18, borderRadius: 20,
            alignItems: 'center', opacity: pressed ? 0.8 : 1,
            shadowColor: iconColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
          }]}
          onPress={onStart}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{buttonTitle}</Text>
        </Pressable>

        {onSkip && (
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [{
              marginTop: 14,
              paddingVertical: 8,
              alignItems: 'center',
              opacity: pressed ? 0.5 : 1,
            }]}
          >
            <Text style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 14,
              fontWeight: '600',
            }}>Skip this player</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Beer Bottle Image (external) ───

export function BeerBottleView({ width: w }: { width: number }) {
  const h = w * 2.4;

  return (
    <View style={{
      shadowColor: 'black',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
      elevation: 10,
    }}>
      <Image
        testID="beer-bottle-img"
        source={require('@/assets/images/tools/bottle.webp')}
        style={{
          width: w,
          height: h,
        }}
        contentFit="contain"
        transition={200}
      />
    </View>
  );
}

// ─── In-Game Skip Button (floating, shown during gameplay) ───

interface InGameSkipButtonProps {
  onSkip: () => void;
  playerName?: string;
}

export function InGameSkipButton({ onSkip, playerName }: InGameSkipButtonProps) {
  const { ask, dialog } = useActionConfirmation();
  return (
    <>
    {dialog}
    <Pressable
      onPress={() => ask({ title: 'Skip turn?', message: `Skip ${playerName || 'this player'}'s current turn?`, label: 'Skip turn', run: onSkip })}
      style={({ pressed }) => [{
        position: 'absolute',
        top: 6,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        opacity: pressed ? 0.5 : 0.7,
        zIndex: 999,
      }]}
    >
      <IconSymbol name="forward.fill" size={10} color="rgba(255,255,255,0.4)" />
      <Text style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
      }}>Skip</Text>
    </Pressable>
    </>
  );
}
