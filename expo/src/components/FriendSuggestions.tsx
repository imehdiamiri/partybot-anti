import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFriendsStore } from '@/src/store/useFriendsStore';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface FriendSuggestionsProps {
  /** Names already in the player list — these will be hidden from suggestions */
  existingNames: string[];
  /** Callback when user taps a friend chip */
  onSelectFriend: (name: string) => void;
  /** Maximum number of suggestions to show (default: 12) */
  maxSuggestions?: number;
}

/**
 * Displays offline friends as clickable chips.
 * Filters out friends whose name already exists in the current player list.
 * Drop this component below any player name input to enable quick-add.
 */
export function FriendSuggestions({
  existingNames,
  onSelectFriend,
  maxSuggestions = 12,
}: FriendSuggestionsProps) {
  const offlineFriends = useFriendsStore(s => s.offlineFriends);

  // Normalise existing names for comparison
  const existingLower = new Set(
    existingNames.map(n => n.trim().toLowerCase()).filter(Boolean)
  );

  // Filter out friends who are already in the list
  const available = offlineFriends
    .filter(f => !existingLower.has(f.name.trim().toLowerCase()))
    .slice(0, maxSuggestions);

  if (available.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <IconSymbol name="person.2.fill" size={11} color="rgba(255,255,255,0.35)" />
        <Text style={styles.label}>Quick Add</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {available.map(friend => (
          <TouchableOpacity
            key={friend.id}
            style={styles.chip}
            activeOpacity={0.65}
            onPress={() => onSelectFriend(friend.name)}
          >
            <IconSymbol name="plus.circle.fill" size={14} color="rgba(52,199,89,0.9)" />
            <Text style={styles.chipText} numberOfLines={1}>{friend.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12.5,
    fontWeight: '700',
    maxWidth: 110,
  },
});
