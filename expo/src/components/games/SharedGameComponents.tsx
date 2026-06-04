import { Colors, Typography } from '@/src/theme/Colors';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp, FadeInDown, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { Player } from '@/src/models/Player';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';

export async function playSharedSound(type: 'success' | 'fail' | 'game_over') {
  try {
    let source;
    if (type === 'success') source = require('@/assets/sounds/success.wav');
    else if (type === 'fail') source = require('@/assets/sounds/fail.wav');
    else if (type === 'game_over') source = require('@/assets/sounds/game_over.wav');

    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (e) {
    // Ignore errors to not crash the game if sound fails
  }
}

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
}

export function GameHandoffView({
  playerName,
  title = "Pass the phone to",
  subtitle,
  accentColor = Colors.blue,
  buttonTitle,
  onReady,
  onSkip,
  rolePillText = "NEXT PLAYER"
}: GameHandoffViewProps) {
  const insets = useSafeAreaInsets();
  
  // Phone slide animation — loops left to right
  const phoneSlide = useSharedValue(0);
  const phoneOpacity = useSharedValue(0);
  useEffect(() => {
    phoneSlide.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 700 }),
        withTiming(1, { duration: 500 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false
    );
    phoneOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 400 }),
        withTiming(1, { duration: 700 }),
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 300 }),
      ),
      -1,
      false
    );
  }, []);

  const phoneAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: phoneSlide.value * 100 }],
    opacity: phoneOpacity.value,
  }));

  // Left hand fades out as phone leaves, right hand brightens as phone arrives
  const leftHandStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + (1 - phoneSlide.value) * 0.5,
  }));

  const rightHandStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + phoneSlide.value * 0.6,
  }));

  const displayButtonTitle = buttonTitle || `I'm ${playerName}`;

  return (
    <View style={[styles.passPhoneContainer, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
      <AppBackgroundView variant="simple" />
      
      {/* Animated phone-passing illustration */}
      <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', marginTop: insets.top + 36 }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: 220,
          height: 72,
        }}>
          {/* Left hand (sender) — palm facing right */}
          <Animated.View style={[{ transform: [{ scaleX: -1 }] }, leftHandStyle]}>
            <IconSymbol name="hand.raised.fill" size={48} color={accentColor} />
          </Animated.View>
          
          {/* Sliding phone — starts near left hand */}
          <Animated.View style={[{ 
            position: 'absolute',
            left: 30,
          }, phoneAnimStyle]}>
            <IconSymbol name="iphone" size={36} color="white" />
          </Animated.View>
          
          {/* Right hand (receiver) — palm facing left */}
          <Animated.View style={rightHandStyle}>
            <IconSymbol name="hand.raised.fill" size={48} color={accentColor} />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Center content */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        



        {/* Title label */}
        <Animated.Text entering={FadeInDown.duration(400).delay(100)} style={{
          fontSize: 13,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: 3,
          marginBottom: 10,
        }}>{title}</Animated.Text>

        {/* Player name */}
        <Animated.Text entering={FadeInDown.duration(400).delay(200)} numberOfLines={1} adjustsFontSizeToFit style={{
          fontSize: 42,
          fontFamily: 'Viral-Black',
          color: 'white',
          letterSpacing: -0.5,
          textAlign: 'center',
          paddingHorizontal: 24,
        }}>{playerName}</Animated.Text>

        {/* Role pill */}
        <Animated.View entering={FadeIn.duration(400).delay(300)} style={{
          marginTop: 16,
          paddingHorizontal: 14,
          paddingVertical: 5,
          borderRadius: 100,
          backgroundColor: `${accentColor}18`,
          borderWidth: 1,
          borderColor: `${accentColor}33`,
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: accentColor,
            letterSpacing: 1.5,
          }}>{rolePillText}</Text>
        </Animated.View>

        {/* Subtitle / privacy note */}
        {subtitle && (
          <Animated.View entering={FadeIn.duration(400).delay(400)} style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 24,
          }}>
            <IconSymbol name="eye.slash.fill" size={14} color="rgba(255,255,255,0.25)" style={{ marginRight: 6 }} />
            <Text style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
              fontWeight: '500',
            }}>{subtitle}</Text>
          </Animated.View>
        )}
      </View>
      
      {/* Bottom button */}
      <Animated.View entering={FadeInUp.duration(450).delay(400)} style={{ width: '100%', paddingHorizontal: 24 }}>
        <Pressable 
          style={({ pressed }) => [{
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            overflow: 'hidden',
            opacity: pressed ? 0.8 : 1,
            backgroundColor: accentColor,
          }]}
          onPress={onReady}
        >
          <Text style={{
            color: 'white',
            fontSize: 17,
            fontFamily: 'Viral-Black',
            letterSpacing: 0.2,
          }}>{displayButtonTitle}</Text>
          <IconSymbol name="arrow.right" size={18} color="rgba(255,255,255,0.8)" />
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
      <LinearGradient colors={[`${accent}33`, 'transparent']} style={StyleSheet.absoluteFillObject} />
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
}

interface GameResultsScreenProps {
  players: Player[];
  results: GameResultData[];
  onPlayAgain: () => void;
  title?: string;
}

export function GameResultsScreen({ players, results, onPlayAgain, title }: GameResultsScreenProps) {
  const sorted = [...results].sort((a, b) => b.score - a.score);

  useEffect(() => {
    // Determine if we should play success or fail sound
    // If all players eliminated or scores very low, maybe fail? Usually results means end of game.
    // We'll play success by default for the results screen!
    playSharedSound('success');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Animated.ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.duration(600).springify().damping(14)} style={{ alignItems: 'center', gap: 12, marginVertical: 30 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,204,0,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,204,0,0.3)' }}>
            <IconSymbol name="trophy.fill" size={48} color={Colors.yellow} />
          </View>
          <Text style={{ color: '#fff', fontSize: 28, fontFamily: 'Viral-Black', letterSpacing: 0.3 }}>{title || (players.length > 1 ? 'Final Rankings' : 'Complete!')}</Text>
        </Animated.View>

        <View style={{ gap: 16 }}>
          {sorted.map((r, i) => {
            const p = players.find(x => x.id === r.playerId);
            const isFirst = i === 0;
            return (
              <Animated.View key={r.playerId} entering={FadeInUp.delay(i * 150).springify().damping(14)} 
                style={[{ 
                  flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, 
                  backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, 
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' 
                }, isFirst && { backgroundColor: 'rgba(255,204,0,0.06)', borderColor: 'rgba(255,204,0,0.2)' }]}>
                
                {isFirst && <LinearGradient colors={['rgba(255,204,0,0.1)', 'transparent']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:1, y:1}} />}
                
                <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }, isFirst && { backgroundColor: 'rgba(255,204,0,0.2)' }]}>
                  <Text style={[{ color: 'rgba(255,255,255,0.5)', fontSize: 18, fontFamily: 'Viral-Black' }, isFirst && { color: Colors.yellow }]}>{i+1}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontFamily: 'Viral-Black', marginBottom: 10 }}>{p?.displayName}</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                    {r.stats.map((stat, idx) => (
                      <View key={idx} style={{ minWidth: 60 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 }}>{stat.label}</Text>
                        <Text style={{ color: stat.color || '#fff', fontSize: 22, fontFamily: 'Viral-Black' }}>{stat.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 }}>Score</Text>
                  <Text style={{ color: isFirst ? Colors.yellow : Colors.orange, fontSize: 36, fontFamily: 'Viral-Black', letterSpacing: -0.5 }}>{r.score}</Text>
                </View>

              </Animated.View>
            );
          })}
        </View>

        <Animated.View entering={FadeInUp.delay(sorted.length * 150 + 200).springify()}>
          <Pressable 
            style={({ pressed }) => [{ 
              backgroundColor: Colors.green, paddingVertical: 18, borderRadius: 20, 
              alignItems: 'center', marginTop: 40, shadowColor: Colors.green, 
              shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 
            }, pressed && { opacity: 0.8 }]} 
            onPress={onPlayAgain}>
            <LinearGradient colors={[Colors.green, '#28A745']} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
            <Text style={{ color: '#fff', fontSize: 18, fontFamily: 'Viral-Black', letterSpacing: 0.3 }}>Play Again</Text>
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
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
  /** Brief result line for the PREVIOUS player, e.g. "Score: 240 · 3 hits" */
  prevResultLine?: string;
  onReady: () => void;
  accentColor?: string;
}

export function GamePlayerCompleteView({
  nextPlayerName, prevResultLine, onReady, accentColor = Colors.orange,
}: GamePlayerCompleteViewProps) {
  return (
    <GameHandoffView
      playerName={nextPlayerName}
      title="Pass the phone to"
      subtitle={prevResultLine}
      accentColor={accentColor}
      buttonTitle={`I'm ${nextPlayerName}`}
      onReady={onReady}
      rolePillText="NEXT TURN"
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

      {playerName && (
        <Animated.View entering={ZoomIn.delay(250).springify().damping(14)}
          style={{ backgroundColor: 'rgba(52,199,89,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginTop: 16, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' }}>
          <Text style={{ color: Colors.green, fontSize: 15, fontFamily: 'Viral-Black' }}>Now · {playerName}</Text>
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

      <Animated.View entering={FadeInUp.delay(380).springify().damping(14)} style={{ width: '100%', marginTop: 44 }}>
        <Pressable
          style={({ pressed }) => [{
            backgroundColor: iconColor, paddingVertical: 18, borderRadius: 20,
            alignItems: 'center', opacity: pressed ? 0.8 : 1,
            shadowColor: iconColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
          }]}
          onPress={onStart}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: 'Viral-Black' }}>{buttonTitle}</Text>
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
        source={require('@/assets/images/tools/bottle.png')}
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
  return (
    <Pressable
      onPress={() => {
        Alert.alert(
          'Skip Turn?',
          playerName
            ? `Skip ${playerName}'s turn? They'll get a score of 0.`
            : "Skip this player's turn? They'll get a score of 0.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Skip', style: 'destructive', onPress: onSkip },
          ]
        );
      }}
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
  );
}
