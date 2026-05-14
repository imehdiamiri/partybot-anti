import { Colors } from '@/src/theme/Colors';
import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GamePlayerColor } from './SharedGameComponents';
import { GameType } from '@/src/models/AppModels';
import { FriendSuggestions } from '@/src/components/FriendSuggestions';

interface SetupPlayersSectionProps {
  playerCount: number;
  playerNames: string[];
  minPlayers: number;
  maxPlayers: number;
  onUpdateCount: (count: number) => void;
  onUpdateName: (index: number, name: string) => void;
}

export function SetupPlayersSection({
  playerCount,
  playerNames,
  minPlayers,
  maxPlayers,
  onUpdateCount,
  onUpdateName
}: SetupPlayersSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <IconSymbol name="person.2.fill" size={16} color={Colors.green} />
          <Text style={[styles.title, { color: Colors.green }]}>Players</Text>
        </View>
        
        <View style={styles.stepperContainer}>
          <Pressable 
            style={[styles.stepperButton, { backgroundColor: 'rgba(52, 199, 89, 0.12)', opacity: playerCount <= 1 ? 0.3 : 1 }]}
            onPress={() => onUpdateCount(Math.max(1, playerCount - 1))}
            disabled={playerCount <= 1}
          >
            <IconSymbol name="minus" size={14} color={Colors.green} />
          </Pressable>
          
          <Text style={[styles.stepperValue, { color: Colors.green }]}>{playerCount}</Text>
          
          <Pressable 
            style={[styles.stepperButton, { backgroundColor: 'rgba(52, 199, 89, 0.12)', opacity: playerCount >= maxPlayers ? 0.3 : 1 }]}
            onPress={() => onUpdateCount(Math.min(maxPlayers, playerCount + 1))}
            disabled={playerCount >= maxPlayers}
          >
            <IconSymbol name="plus" size={14} color={Colors.green} />
          </Pressable>
        </View>
      </View>

      <View style={styles.playersList}>
        {Array.from({ length: playerCount }).map((_, index) => (
          <View key={index} style={styles.playerInputRow}>
            <View style={[styles.playerBadge, { backgroundColor: GamePlayerColor.color(index) + '22' }]}>
              <Text style={[styles.playerBadgeText, { color: GamePlayerColor.color(index) }]}>
                {index + 1}
              </Text>
            </View>
            <TextInput
              style={styles.playerInput}
              value={playerNames[index] || ''}
              onChangeText={(text) => onUpdateName(index, text)}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity
              style={styles.clearPlayerBtn}
              onPress={() => {
                if (playerCount > 1) {
                  // Remove this player: shift names up and decrease count
                  const newNames = [...playerNames];
                  newNames.splice(index, 1);
                  newNames.forEach((n, i) => onUpdateName(i, n));
                  onUpdateName(newNames.length, '');
                  onUpdateCount(playerCount - 1);
                } else {
                  // At minimum — just clear the field text
                  onUpdateName(index, '');
                }
              }}
            >
              <IconSymbol name="xmark" size={10} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Friend Suggestions – quick-add offline friends */}
      <FriendSuggestions
        existingNames={playerNames.filter(Boolean)}
        onSelectFriend={(name) => {
          // First try to fill an empty slot
          const emptyIndex = playerNames.findIndex((n, i) => i < playerCount && !n.trim());
          if (emptyIndex !== -1) {
            onUpdateName(emptyIndex, name);
          } else if (playerCount < maxPlayers) {
            // All slots filled — add a new field
            onUpdateCount(playerCount + 1);
            setTimeout(() => onUpdateName(playerCount, name), 50);
          }
        }}
      />
    </View>
  );
}

interface SetupRoundsSectionProps {
  roundCount: number;
  minRounds?: number;
  maxRounds?: number;
  onUpdateRounds: (count: number) => void;
}

export function SetupRoundsSection({
  roundCount,
  minRounds = 1,
  maxRounds = 10,
  onUpdateRounds
}: SetupRoundsSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <IconSymbol name="repeat" size={16} color={Colors.orange} />
          <Text style={[styles.title, { color: Colors.orange }]}>Rounds</Text>
        </View>
        
        <View style={styles.stepperContainer}>
          <Pressable 
            style={[styles.stepperButton, { backgroundColor: 'rgba(255, 149, 0, 0.12)' }]}
            onPress={() => onUpdateRounds(Math.max(minRounds, roundCount - 1))}
            disabled={roundCount <= minRounds}
          >
            <IconSymbol name="minus" size={14} color={Colors.orange} />
          </Pressable>
          
          <Text style={[styles.stepperValue, { color: Colors.orange }]}>{roundCount}</Text>
          
          <Pressable 
            style={[styles.stepperButton, { backgroundColor: 'rgba(255, 149, 0, 0.12)' }]}
            onPress={() => onUpdateRounds(Math.min(maxRounds, roundCount + 1))}
            disabled={roundCount >= maxRounds}
          >
            <IconSymbol name="plus" size={14} color={Colors.orange} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface SetupStartButtonProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  tint?: string;
  disabled?: boolean;
  onPress: () => void;
}

export function SetupStartButton({
  title = "Start Game",
  subtitle,
  icon = "play.fill",
  tint = "#007AFF",
  disabled = false,
  onPress
}: SetupStartButtonProps) {
  return (
    <Pressable 
      style={[styles.startButton, { backgroundColor: tint, opacity: disabled ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <IconSymbol name={icon as any} size={20} color="white" />
      <View style={styles.startTextContainer}>
        <Text style={styles.startButtonText}>{title}</Text>
        {subtitle && <Text style={styles.startButtonSubtitle}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 28,
    textAlign: 'center',
  },
  playersList: {
    marginTop: 16,
    gap: 8,
  },
  playerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  playerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  clearPlayerBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
  },
  startTextContainer: {
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  startButtonSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  }
});
