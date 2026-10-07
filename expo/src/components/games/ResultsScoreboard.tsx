import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useReplayGuide } from './GameStartGuide';

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

export function ResultsScoreboard({
  entries, title = 'Final Results', subtitle, onPlayAgain, shareGameName,
  playAgainTitle = 'Play Again', playAgainIcon = 'arrow.clockwise', badgeLabel = 'STANDINGS',
}: Props) {
  const showReplayGuide = useReplayGuide();
  const completed = entries.filter(e => !e.isSkipped && e.primary !== 'Skipped' && e.primary !== '—');
  const skipped = entries.filter(e => e.isSkipped || e.primary === 'Skipped' || e.primary === '—');
  // Callers own game-specific ranking and units. Never sort formatted scores here.
  const winner = completed[0];
  useEffect(() => {
    import('@/src/services/AudioManager').then(({ AudioManager }) => AudioManager.play('success')).catch(() => {});
  }, []);
  const share = async () => {
    try {
      await Share.share({ message: [
        `${winner ? winner.name + ' won' : 'Finished'} ${shareGameName} on PartyBot!`,
        winner ? 'Score: ' + winner.primary : '',
        'Play with friends → https://partybot.games',
      ].filter(Boolean).join('\n') });
    } catch {}
  };
  return <View testID="final-results" style={styles.wrap}>
    <View style={styles.header}>
      <View accessible={false} style={styles.podium}>
        {[24, 40, 16].map((height, i) => <View key={i} style={{ width: 12, height, borderRadius: 3, backgroundColor: i === 1 ? '#68E8A8' : '#35495A' }} />)}
      </View>
      <Text style={styles.eyebrow}>{badgeLabel}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {winner ? <View testID="results-winner" style={styles.winner}>
      <View style={styles.winnerHeading}><Text style={styles.rank}>01</Text><Text style={styles.eyebrow}>WINNER</Text></View>
      <Text style={[styles.winnerName, winner.nameColor ? { color: winner.nameColor } : null]}>{winner.name}</Text>
      <Text style={styles.score}>{winner.primary}</Text>
      {!!winner.secondary && <Text style={styles.subtitle}>{winner.secondary}</Text>}
    </View> : <View style={styles.winner}>
      <Text style={styles.title}>Round Ended</Text>
      <Text style={styles.subtitle}>No completed scores recorded this round.</Text>
    </View>}
    {completed.slice(1).map((entry, i) => <View key={entry.id} style={styles.row}>
      <Text style={styles.rank}>{String(i + 2).padStart(2, '0')}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.name, entry.nameColor ? { color: entry.nameColor } : null]}>{entry.name}</Text>
        <Text style={styles.metric}>{entry.primary}</Text>
        {!!entry.secondary && <Text style={styles.detail}>{entry.secondary}</Text>}
      </View>
    </View>)}
    {!!skipped.length && <Text style={styles.eyebrow}>DID NOT PLAY / SKIPPED</Text>}
    {skipped.map(entry => <View key={entry.id} style={styles.row}>
      <Text style={styles.rank}>—</Text>
      <View style={styles.rowBody}><Text style={styles.name}>{entry.name}</Text>
        <Text style={styles.detail}>{entry.secondary || 'Skipped turn'}</Text>
      </View><Text style={styles.skipped}>Skipped</Text>
    </View>)}
    <View style={styles.actions}>
      {!!onPlayAgain && <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => showReplayGuide(onPlayAgain)}>
        <IconSymbol name={playAgainIcon as any} size={20} color="#10151E" />
        <Text style={styles.buttonText}>{playAgainTitle}</Text>
      </TouchableOpacity>}
      {!!shareGameName && <TouchableOpacity accessibilityRole="button" style={styles.shareButton} onPress={share}>
        <IconSymbol name="square.and.arrow.up" size={20} color="#DCE3F0" />
        <Text style={styles.name}>Share</Text>
      </TouchableOpacity>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 12, paddingBottom: 24 },
  header: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginBottom: 8 },
  eyebrow: { color: '#AAB8CC', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#F3F6FB', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#B6C2D5', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  winner: { backgroundColor: '#14251F', borderColor: '#355E4F', borderWidth: 1, borderRadius: 22, padding: 24, alignItems: 'center', gap: 12 },
  winnerHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  winnerName: { color: '#68E8A8', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  score: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { backgroundColor: '#171D28', borderColor: '#2D3545', borderWidth: 1, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rank: { color: '#8AA698', fontSize: 22, fontWeight: '700', minWidth: 30, fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  name: { color: '#E8EEF7', fontSize: 16, fontWeight: '700' },
  metric: { color: '#FFFFFF', fontSize: 19, fontWeight: '600' },
  detail: { color: '#AAB8CC', fontSize: 13, lineHeight: 19 },
  skipped: { color: '#C3AD94', fontSize: 12 },
  actions: { gap: 10, marginTop: 12 },
  primaryButton: { minHeight: 56, padding: 16, borderRadius: 16, backgroundColor: '#F1F5FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#10151E', fontSize: 17, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  shareButton: { minHeight: 48, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
});
export { Platform };
