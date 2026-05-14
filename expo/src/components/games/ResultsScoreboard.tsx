import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Colors } from '@/src/theme/Colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
}

export function ResultsScoreboard({
  entries,
  title = 'Final Results',
  subtitle,
  trophyColor = Colors.yellow,
  onPlayAgain,
  shareGameName,
}: Props) {
  const handleShare = async () => {
    if (!shareGameName) return;
    try {
      const winner = entries[0];
      const lines = [
        `🏆 ${winner?.name ?? 'I'} won ${shareGameName} on PartyBot!`,
        `${winner?.primary ?? ''}`.trim(),
        '',
        'Play with friends → https://www.partybot.games',
      ].filter(Boolean);
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <IconSymbol name="trophy.fill" size={36} color={trophyColor} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {(onPlayAgain || shareGameName) && (
        <View style={styles.ctas}>
          {onPlayAgain && (
            <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} accessibilityRole="button">
              <IconSymbol name="arrow.clockwise" size={16} color="white" />
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          )}
          {shareGameName && (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} accessibilityRole="button">
              <IconSymbol name="square.and.arrow.up" size={16} color="white" />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.list}>
        {entries.map((entry, idx) => (
          <View key={entry.id} style={[styles.row, idx === 0 && styles.rowWinner]}>
            <View style={[styles.badge, idx === 0 && styles.badgeWinner]}>
              <Text style={[styles.badgeText, idx === 0 && styles.badgeTextWinner]}>
                #{idx + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, entry.nameColor ? { color: entry.nameColor } : null]}>
                {entry.name}
              </Text>
              {entry.secondary ? (
                <Text style={styles.secondary}>{entry.secondary}</Text>
              ) : null}
            </View>
            <Text style={[styles.primary, idx === 0 && styles.primaryWinner]}>
              {entry.primary}
            </Text>
            {idx === 0 && <IconSymbol name="crown.fill" size={18} color={trophyColor} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  header: { alignItems: 'center', gap: 6 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  rowWinner: {
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderColor: 'rgba(255,204,0,0.22)',
  },
  badge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeWinner: { backgroundColor: 'rgba(255,214,10,0.22)' },
  badgeText: { color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' },
  badgeTextWinner: { color: Colors.yellow },
  name: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  secondary: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  primary: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  primaryWinner: { color: Colors.green },
  ctas: { flexDirection: 'row', gap: 10 },
  playAgainBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, backgroundColor: Colors.green,
  },
  playAgainText: { color: 'white', fontSize: 16, fontWeight: '700' },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(0,122,255,0.85)',
  },
  shareText: { color: 'white', fontSize: 16, fontWeight: '700' },
});

// Re-export Platform so callers can detect ios-only behaviours if needed.
export { Platform };
