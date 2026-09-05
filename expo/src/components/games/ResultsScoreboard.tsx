import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Colors } from '@/src/theme/Colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';

/**
 * Shared modern final scoreboard primitive used across mini-games.
 * Renders an ultra-modern ranking card with podium highlights and
 * dedicated handling for skipped / DNF players.
 */

export interface RankEntry {
  id: string;
  name: string;
  /** Primary metric shown on the right (e.g. "12.4s" or "350 pts") or "Skipped". */
  primary: string;
  /** Optional secondary line under the player name. */
  secondary?: string;
  /** Optional tint override for the player name. */
  nameColor?: string;
  /** When true, player is clearly marked as skipped and placed at the bottom without winning. */
  isSkipped?: boolean;
}

interface Props {
  entries: RankEntry[];
  title?: string;
  subtitle?: string;
  /** When provided, renders a primary "Play Again" CTA under the scoreboard. */
  onPlayAgain?: () => void;
  /** Game name used in the share-card text; enables a share button when set. */
  shareGameName?: string;
  playAgainTitle?: string;
  playAgainIcon?: string;
  badgeLabel?: string;
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
  return <View style={[style, { backgroundColor: 'rgba(20,20,28,0.85)' }]}>{children}</View>;
};

export function ResultsScoreboard({
  entries,
  title = 'Final Results',
  subtitle,
  onPlayAgain,
  shareGameName,
  playAgainTitle = 'Play Again',
  playAgainIcon = 'arrow.clockwise',
  badgeLabel = 'STANDINGS',
}: Props) {
  const handleShare = async () => {
    if (!shareGameName) return;
    try {
      const winner = validCompleted[0];
      const lines = [
        `🎮 ${winner ? `${winner.name} won` : 'Finished'} ${shareGameName} on PartyBot!`,
        winner?.primary ? `Score: ${winner.primary}` : '',
        '',
        'Play with friends → https://partybot.games',
      ].filter(Boolean);
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  useEffect(() => {
    import('@/src/services/AudioManager').then(({ AudioManager }) => {
      AudioManager.play('success');
    }).catch(() => {});
  }, []);

  // Separate completed players from skipped players
  const validCompleted = entries.filter(e => !e.isSkipped && e.primary !== 'Skipped' && e.primary !== '—');
  const skippedList = entries.filter(e => e.isSkipped || e.primary === 'Skipped' || e.primary === '—');

  const winner = validCompleted.length > 0 ? validCompleted[0] : null;
  const runnersUp = validCompleted.length > 1 ? validCompleted.slice(1) : [];

  return (
    <View style={styles.wrap}>
      {/* Modern Header (No Trophy Icon) */}
      <Animated.View entering={FadeInDown.duration(500).springify().damping(15)} style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>{badgeLabel}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>

      <View style={styles.list}>
        {/* Winner Hero Card (Only if a valid completed winner exists) */}
        {winner && (
          <Animated.View entering={FadeInUp.delay(100).springify().damping(14)}>
            <View style={styles.winnerCardWrapper}>
              <LinearGradient
                colors={['rgba(255, 215, 0, 0.18)', 'rgba(255, 140, 0, 0.08)', 'rgba(0, 0, 0, 0.4)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['#FFD700', '#FFA500', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.winnerTopBar}
              />

              <View style={styles.winnerCardInner}>
                <View style={styles.winnerCrownBadge}>
                  <Text style={styles.crownEmoji}>👑</Text>
                  <Text style={styles.winnerCrownText}>WINNER</Text>
                  <Text style={styles.crownEmoji}>👑</Text>
                </View>

                <Text 
                  style={[styles.winnerName, winner.nameColor ? { color: winner.nameColor } : null]} 
                  numberOfLines={1}
                >
                  {winner.name}
                </Text>

                <View style={styles.winnerScoreContainer}>
                  <Text style={styles.winnerPrimary}>{winner.primary}</Text>
                  {winner.secondary ? (
                    <View style={styles.winnerSecondaryBadge}>
                      <Text style={styles.winnerSecondary}>{winner.secondary}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* If no players finished */}
        {!winner && validCompleted.length === 0 && (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.allSkippedCard}>
            <Text style={styles.allSkippedEmoji}>⚡</Text>
            <Text style={styles.allSkippedTitle}>Round Ended</Text>
            <Text style={styles.allSkippedSub}>No completed scores recorded this round.</Text>
          </Animated.View>
        )}

        {/* Runners Up List (#2, #3, etc.) */}
        {runnersUp.map((entry, idx) => {
          const rankNumber = idx + 2;
          const isSecond = rankNumber === 2;
          const isThird = rankNumber === 3;
          const badgeColor = isSecond ? '#E2E8F0' : isThird ? '#CD7F32' : 'rgba(255,255,255,0.7)';
          const badgeBg = isSecond ? 'rgba(226, 232, 240, 0.15)' : isThird ? 'rgba(205, 127, 50, 0.15)' : 'rgba(255,255,255,0.06)';

          return (
            <Animated.View 
              key={entry.id} 
              entering={FadeInUp.delay(150 + idx * 80).springify().damping(14)} 
            >
              <SurfaceBlur style={styles.runnerRow} intensity={45}>
                <View style={[styles.runnerBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.runnerBadgeText, { color: badgeColor }]}>#{rankNumber}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.runnerName, entry.nameColor ? { color: entry.nameColor } : null]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  {entry.secondary ? <Text style={styles.runnerSecondary}>{entry.secondary}</Text> : null}
                </View>

                <View style={styles.runnerScoreCol}>
                  <Text style={styles.runnerPrimary}>{entry.primary}</Text>
                </View>
              </SurfaceBlur>
            </Animated.View>
          );
        })}

        {/* Skipped / Incomplete Players Section */}
        {skippedList.length > 0 && (
          <View style={styles.skippedSection}>
            <View style={styles.skippedDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.skippedHeaderTitle}>Did Not Play / Skipped</Text>
              <View style={styles.dividerLine} />
            </View>

            {skippedList.map((entry, idx) => (
              <Animated.View 
                key={entry.id} 
                entering={FadeInUp.delay(250 + idx * 60).springify().damping(14)} 
              >
                <View style={styles.skippedRow}>
                  <View style={styles.skippedBadge}>
                    <Text style={styles.skippedBadgeText}>—</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.skippedName} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <Text style={styles.skippedSub}>{entry.secondary || 'Skipped turn'}</Text>
                  </View>

                  <View style={styles.skippedPill}>
                    <Text style={styles.skippedPillText}>Skipped</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      {/* Modern CTAs */}
      {(onPlayAgain || shareGameName) && (
        <Animated.View entering={FadeInUp.delay(300 + entries.length * 60).springify().damping(14)} style={styles.ctas}>
          {onPlayAgain && (
            <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} accessibilityRole="button" activeOpacity={0.85}>
              <LinearGradient 
                colors={['#3B82F6', '#2563EB', '#1D4ED8']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                style={StyleSheet.absoluteFill}
              />
              <IconSymbol name={playAgainIcon as any} size={20} color="white" />
              <Text style={styles.playAgainText}>{playAgainTitle}</Text>
            </TouchableOpacity>
          )}
          {shareGameName && (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" activeOpacity={0.85}>
              <SurfaceBlur style={StyleSheet.absoluteFill} intensity={60} />
              <IconSymbol name="square.and.arrow.up" size={18} color="white" />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20, paddingHorizontal: 4, paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  
  // Header
  header: { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 8 },
  badgePill: {
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 4,
  },
  badgePillText: {
    color: '#A855F7', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  title: { color: 'white', fontSize: 30, fontFamily: 'Viral-Black', letterSpacing: 0.2, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '500', textAlign: 'center' },
  
  list: { gap: 12 },
  
  // Winner Card Styles
  winnerCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    backgroundColor: 'rgba(18, 18, 24, 0.8)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  winnerTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  winnerCardInner: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  winnerCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  crownEmoji: { fontSize: 13 },
  winnerCrownText: { color: '#FFD700', fontSize: 12, fontFamily: 'Viral-Black', letterSpacing: 1.5 },
  winnerName: { color: 'white', fontSize: 26, fontFamily: 'Viral-Black', textAlign: 'center', marginBottom: 8 },
  winnerScoreContainer: { alignItems: 'center', gap: 6 },
  winnerPrimary: { 
    color: '#22C55E', fontSize: 38, fontFamily: 'Viral-Black', letterSpacing: -0.5,
    textShadowColor: 'rgba(34, 197, 94, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  winnerSecondaryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  winnerSecondary: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  // All Skipped State
  allSkippedCard: {
    padding: 24, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', gap: 8,
  },
  allSkippedEmoji: { fontSize: 32 },
  allSkippedTitle: { color: '#fff', fontSize: 18, fontFamily: 'Viral-Black' },
  allSkippedSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },

  // Runners up Styles
  runnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  runnerBadge: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  runnerBadgeText: { fontFamily: 'Viral-Black', fontSize: 14 },
  runnerName: { color: 'white', fontSize: 16, fontFamily: 'Viral-Black' },
  runnerSecondary: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  runnerScoreCol: { alignItems: 'flex-end', justifyContent: 'center' },
  runnerPrimary: { color: 'white', fontSize: 18, fontFamily: 'Viral-Black' },

  // Skipped Section Styles
  skippedSection: { marginTop: 10, gap: 8 },
  skippedDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  skippedHeaderTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  skippedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    opacity: 0.75,
  },
  skippedBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  skippedBadgeText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 'bold' },
  skippedName: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  skippedSub: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 },
  skippedPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  skippedPillText: { color: '#F87171', fontSize: 11, fontWeight: '700' },

  // CTAs
  ctas: { flexDirection: 'row', gap: 12, marginTop: 16, maxWidth: 540, width: '100%', alignSelf: 'center' },
  playAgainBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  playAgainText: { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  shareText: { color: 'white', fontSize: 15, fontWeight: '600' },
});

export { Platform };
