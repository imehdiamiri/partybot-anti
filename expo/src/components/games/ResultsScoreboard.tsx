import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Colors } from '@/src/theme/Colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';

/**
 * Shared "final scoreboard" primitive used by Memory Grid, Guess the Seconds
 * and Pass & Guess. Renders a sorted ranking with a winner highlight.
 *
 * Pass `entries` already sorted (best → worst). The first row is gilded.
 */

export interface RankEntry {
  id: string;
  name: string;
  /** Primary metric shown big on the right (e.g. "12 pts" or "3.21s"). */
  primary: string;
  /** Optional secondary line under the player name. */
  secondary?: string;
  /** Optional tint override for the player name. */
  nameColor?: string;
}

interface Props {
  entries: RankEntry[];
  title?: string;
  subtitle?: string;
  trophyColor?: string;
  /** When provided, renders a primary "Play Again" CTA under the scoreboard. */
  onPlayAgain?: () => void;
  /** Game name used in the share-card text; enables a share button when set. */
  shareGameName?: string;
  playAgainTitle?: string;
  playAgainIcon?: string;
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

export function ResultsScoreboard({
  entries,
  title = 'Final Results',
  subtitle,
  trophyColor = Colors.yellow,
  onPlayAgain,
  shareGameName,
  playAgainTitle = 'Play Again',
  playAgainIcon = 'arrow.clockwise',
}: Props) {
  const handleShare = async () => {
    if (!shareGameName) return;
    try {
      const winner = entries[0];
      const lines = [
        `🏆 ${winner?.name ?? 'I'} won ${shareGameName} on PlayVirals!`,
        `${winner?.primary ?? ''}`.trim(),
        '',
        'Play with friends → https://www.playvirals.com',
      ].filter(Boolean);
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  useEffect(() => {
    // Attempt to play a sound on mount to make it exciting
    import('@/src/services/AudioManager').then(({ AudioManager }) => {
      AudioManager.play('success');
    }).catch(() => {});
  }, []);

  const winner = entries[0];
  const runnersUp = entries.slice(1);

  return (
    <View style={styles.wrap}>
      {/* Header with Animated Trophy */}
      <Animated.View entering={FadeInDown.duration(600).springify().damping(14)} style={styles.header}>
        <View style={styles.trophyContainer}>
          <Animated.View entering={ZoomIn.delay(200).springify().damping(12)}>
            <IconSymbol name="trophy.fill" size={72} color={trophyColor} />
          </Animated.View>
          <View style={[styles.trophyGlow, { backgroundColor: trophyColor }]} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>

      <View style={styles.list}>
        {/* Winner Card */}
        {winner && (
          <Animated.View entering={FadeInUp.delay(100).springify().damping(14)}>
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 140, 0, 0.15)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.winnerCardWrapper}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.winnerBorder}
              />
              <View style={styles.winnerCardInner}>
                <View style={styles.winnerHeader}>
                  <IconSymbol name="crown.fill" size={26} color="#FFD700" />
                  <Text style={styles.winnerText}>WINNER</Text>
                  <IconSymbol name="crown.fill" size={26} color="#FFD700" />
                </View>
                <Text 
                  style={[styles.winnerName, winner.nameColor ? { color: winner.nameColor } : null]} 
                  numberOfLines={1}
                >
                  {winner.name}
                </Text>
                <Text style={styles.winnerPrimary}>{winner.primary}</Text>
                {winner.secondary ? <Text style={styles.winnerSecondary}>{winner.secondary}</Text> : null}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Runners up */}
        {runnersUp.map((entry, idx) => (
          <Animated.View 
            key={entry.id} 
            entering={FadeInUp.delay(200 + idx * 100).springify().damping(14)} 
          >
            <SurfaceBlur style={styles.runnerRow} intensity={50}>
              <View style={styles.runnerBadge}>
                <Text style={styles.runnerBadgeText}>#{idx + 2}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.runnerName, entry.nameColor ? { color: entry.nameColor } : null]}>
                  {entry.name}
                </Text>
                {entry.secondary ? <Text style={styles.runnerSecondary}>{entry.secondary}</Text> : null}
              </View>
              <Text style={styles.runnerPrimary}>{entry.primary}</Text>
            </SurfaceBlur>
          </Animated.View>
        ))}
      </View>

      {/* CTAs */}
      {(onPlayAgain || shareGameName) && (
        <Animated.View entering={FadeInUp.delay(300 + runnersUp.length * 100).springify().damping(14)} style={styles.ctas}>
          {onPlayAgain && (
            <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} accessibilityRole="button" activeOpacity={0.8}>
              <LinearGradient 
                colors={[Colors.blue, '#0A58D6']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                style={StyleSheet.absoluteFillObject} 
              />
              <IconSymbol name={playAgainIcon as any} size={22} color="white" />
              <Text style={styles.playAgainText}>{playAgainTitle}</Text>
            </TouchableOpacity>
          )}
          {shareGameName && (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" activeOpacity={0.8}>
              <SurfaceBlur style={StyleSheet.absoluteFillObject} intensity={70} />
              <IconSymbol name="square.and.arrow.up" size={20} color="white" />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24, paddingHorizontal: 4 },
  header: { alignItems: 'center', gap: 10, marginTop: 16 },
  trophyContainer: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  trophyGlow: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    opacity: 0.4,
    transform: [{ scale: 1.6 }],
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 12,
  },
  title: { color: 'white', fontSize: 28, fontFamily: 'Viral-Black', letterSpacing: 0.3, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  
  list: { gap: 16 },
  
  // Winner Card Styles
  winnerCardWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  winnerBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 4,
    opacity: 0.9,
  },
  winnerCardInner: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
  },
  winnerText: { color: '#FFD700', fontSize: 13, fontFamily: 'Viral-Black', letterSpacing: 2 },
  winnerName: { color: 'white', fontSize: 28, fontFamily: 'Viral-Black', textAlign: 'center', marginBottom: 10 },
  winnerPrimary: { color: Colors.green, fontSize: 40, fontFamily: 'Viral-Black', letterSpacing: -0.5, textShadowColor: 'rgba(52, 199, 89, 0.4)', textShadowOffset: {width: 0, height: 4}, textShadowRadius: 10 },
  winnerSecondary: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', marginTop: 10 },

  // Runners up Styles
  runnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 20, borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  runnerBadge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  runnerBadgeText: { color: 'rgba(255,255,255,0.95)', fontFamily: 'Viral-Black', fontSize: 16 },
  runnerName: { color: 'white', fontSize: 18, fontFamily: 'Viral-Black' },
  runnerSecondary: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 5, fontWeight: '600' },
  runnerPrimary: { color: 'white', fontSize: 22, fontFamily: 'Viral-Black' },

  // CTA Styles
  ctas: { flexDirection: 'row', gap: 16, marginTop: 24 },
  playAgainBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 22, borderRadius: 24, overflow: 'hidden',
    shadowColor: Colors.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  playAgainText: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.3 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 22, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  shareText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
});

// Re-export Platform so callers can detect ios-only behaviours if needed.
export { Platform };
