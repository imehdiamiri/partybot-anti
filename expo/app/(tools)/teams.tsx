import { Colors } from '@/src/theme/Colors';
import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  ScrollView,
  Alert,
  Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioManager } from '@/src/services/AudioManager';
import { FriendSuggestions } from '@/src/components/FriendSuggestions';

const TEAM_COLORS = [Colors.orange, Colors.cyan, '#FF2D55', Colors.green, '#AF52DE', Colors.yellow];
const TEAM_ICONS = ['flame.fill', 'bolt.fill', 'heart.fill', 'leaf.fill', 'star.fill', 'sparkles'];

const playDiceRoll = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  AudioManager.play('phaseChange');
};
const playButtonTap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  AudioManager.play('buttonTap');
};
const playSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  AudioManager.play('success');
};
const playError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  AudioManager.play('wrong');
};

export default function TeamSplitterToolScreen() {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][]>([]);
  const [isShuffling, setIsShuffling] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const addName = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    
    if (names.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      playError();
      Alert.alert(
        "Duplicate name",
        `“${trimmed}” is already in the list. Please use a different name.`
      );
      return;
    }
    
    setNames([...names, trimmed]);
    setDraft("");
    playButtonTap();
  };

  const removeName = (index: number) => {
    setNames(names.filter((_, i) => i !== index));
    playButtonTap();
  };

  const split = () => {
    if (names.length < teamCount) return;
    
    setIsShuffling(true);
    playDiceRoll();
    Keyboard.dismiss();

    // Shuffle array
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const buckets: string[][] = Array.from({ length: teamCount }, () => []);
    
    shuffled.forEach((name, i) => {
      buckets[i % teamCount].push(name);
    });

    // Simulate animation delay
    setTimeout(() => {
      setTeams(buckets);
      
      setTimeout(() => {
        setIsShuffling(false);
        playSuccess();
      }, 50);
    }, 450);
  };

  return (
    <View style={styles.container}>
      {/* Input Row */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={addName}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          onPress={addName}
          disabled={!draft.trim()}
          style={({ pressed }) => [
            styles.addButton,
            pressed && { opacity: 0.8 },
            !draft.trim() && { opacity: 0.5 }
          ]}
        >
          <IconSymbol name="plus" size={16} color="white" weight="black" />
        </Pressable>
      </View>

      {/* Friend Suggestions */}
      <FriendSuggestions
        existingNames={names}
        onSelectFriend={(name) => {
          if (names.some(n => n.toLowerCase() === name.toLowerCase())) return;
          setNames(prev => [...prev, name]);
          playButtonTap();
        }}
      />

      {/* Names Chips */}
      {names.length > 0 && (
        <View style={styles.chipsWrapper}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {names.map((name, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
                <Pressable onPress={() => removeName(i)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="xmark" size={10} color="white" weight="black" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Team Count Selector */}
      <View style={styles.teamCountContainer}>
        <Text style={styles.teamCountLabel}>TEAMS</Text>
        <View style={styles.teamCountRow}>
          {[2, 3, 4, 5, 6].map(n => {
            const isSelected = teamCount === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  if (isShuffling) return;
                  playButtonTap();
                  setTeamCount(n);
                }}
                style={[
                  styles.countBtn,
                  isSelected ? styles.countBtnSelected : styles.countBtnUnselected
                ]}
                disabled={isShuffling}
              >
                <Text style={[
                  styles.countBtnText,
                  isSelected ? styles.countBtnTextSelected : styles.countBtnTextUnselected
                ]}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.mainScroll}
        keyboardDismissMode="on-drag"
        contentContainerStyle={teams.length === 0 ? styles.emptyStateContainer : styles.teamsGrid}
      >
        {teams.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="person.2.badge.gearshape.fill" size={44} color="rgba(255,255,255,0.4)" weight="semibold" />
            <Text style={styles.emptyStateTitle}>Add names then tap Split</Text>
            <Text style={styles.emptyStateDesc}>Players will be randomly distributed into teams.</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {teams.map((members, idx) => {
              const color = TEAM_COLORS[idx % TEAM_COLORS.length];
              const icon = TEAM_ICONS[idx % TEAM_ICONS.length];
              return (
                <View key={idx} style={[styles.teamCard, { backgroundColor: `${color}1A`, borderColor: `${color}4D` }]}>
                  <View style={styles.teamHeader}>
                    <IconSymbol name={icon as any} size={12} color={color} weight="bold" />
                    <Text style={styles.teamName}>Team {idx + 1}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.teamSize}>{members.length}</Text>
                  </View>
                  <View style={styles.teamMembers}>
                    {members.map((name, i) => (
                      <View key={i} style={styles.memberRow}>
                        <View style={[styles.memberDot, { backgroundColor: `${color}B3` }]} />
                        <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
                      </View>
                    ))}
                    {members.length === 0 && (
                      <Text style={styles.emptyMemberText}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Split Button */}
      <Pressable
        onPress={split}
        disabled={names.length < teamCount || isShuffling}
        style={({ pressed }) => [
          styles.splitButtonContainer,
          pressed && { opacity: 0.8 },
          (names.length < teamCount) && { opacity: 0.5 },
          isShuffling && { opacity: 0.8 }
        ]}
      >
        <LinearGradient
          colors={[Colors.green, '#30B0C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.splitButton}
        >
          <IconSymbol name="shuffle" size={20} color="white" weight="heavy" />
          <Text style={styles.splitButtonText}>
            {teams.length === 0 ? "Split into Teams" : "Shuffle Again"}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  input: {
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.green,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsWrapper: {
    marginBottom: 14,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamCountContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  teamCountLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
  },
  teamCountRow: {
    flexDirection: 'row',
    gap: 6,
  },
  countBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  countBtnSelected: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  countBtnUnselected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  countBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  countBtnTextSelected: {
    color: 'black',
  },
  countBtnTextUnselected: {
    color: 'white',
  },
  mainScroll: {
    flex: 1,
  },
  emptyStateContainer: {
    flexGrow: 1,
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  emptyStateDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  teamsGrid: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  teamCard: {
    width: '48.5%', // Slightly less than 50% to account for gap
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  teamName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
  teamSize: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  teamMembers: {
    gap: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  memberName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  emptyMemberText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  splitButtonContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 10,
    borderRadius: 999,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    gap: 10,
  },
  splitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
});
