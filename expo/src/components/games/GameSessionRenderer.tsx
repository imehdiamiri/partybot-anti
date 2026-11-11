import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameType } from '@/src/models/AppModels';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ReverseSingingSession } from './ReverseSingingSession';
import { GuessTheSecondsSession } from './GuessTheSecondsSession';
import { PassGuessSession } from './PassGuessSession';
import { ImposterSession } from './ImposterSession';

import { MemoryGridSession } from './MemoryGridSession';
import { MemoryPathSession } from './MemoryPathSession';
import { TapInOrderSession } from './TapInOrderSession';
import { TenTangleSession } from './TenTangleSession';
import { ColorTrapSession } from './ColorTrapSession';
import { SpinBottleSession } from './SpinBottleSession';
import { DrawRushSession } from './DrawRushSession';
import { ReactionTimeSession } from './ReactionTimeSession';
import { EyeSightSession } from './EyeSightSession';
import { DrumChallengeSession } from './DrumChallengeSession';
import { ColorMatchSession } from './ColorMatchSession';
import { SoundMatchSession } from './SoundMatchSession';

interface Props {
  session: GameSession;
  game: GameType;
}

export function GameSessionRenderer({ session, game }: Props) {
  switch (game.id) {
    case 'reverse_singing':
      return <ReverseSingingSession session={session} />;
    case 'guess_the_seconds':
      return <GuessTheSecondsSession session={session} />;
    case 'imposter':
      return <ImposterSession session={session} />;
    case 'pass_guess':
      return <PassGuessSession session={session} />;
    case 'memory_grid':
      return <MemoryGridSession session={session} />;
    case 'memory_path':
      return <MemoryPathSession session={session} />;
    case 'tap_in_order':
      return <TapInOrderSession session={session} />;
    case 'ten_tangle':
      return <TenTangleSession session={session} />;
    case 'color_trap':
      return <ColorTrapSession session={session} />;
    case 'spin_bottle':
      return <SpinBottleSession session={session} />;
    case 'draw_rush':
      return <DrawRushSession session={session} />;
    case 'reaction_time':
      return <ReactionTimeSession session={session} />;
    case 'eye_sight':
      return <EyeSightSession session={session} />;
    case 'drum_challenge':
      return <DrumChallengeSession session={session} />;
    case 'color_match':
      return <ColorMatchSession session={session} />;
    case 'sound_match':
      return <SoundMatchSession session={session} />;
    default:
      return <GenericPlaceholder session={session} game={game} />;
  }
}

function GenericPlaceholder({ session, game }: Props) {
  return (
    <View style={styles.content}>
      <IconSymbol name="gamecontroller.fill" size={64} color="rgba(255,255,255,0.2)" />
      <Text style={styles.gameTitle}>{game.name}</Text>
      <Text style={styles.gameSubtitle}>
        Playing with {session.players.length} players
      </Text>
      
      <View style={styles.playersList}>
        {session.players.map(player => (
          <View key={player.id} style={styles.playerBadge}>
            <Text style={styles.playerName}>{player.displayName}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.roundText}>
        Round {session.currentRoundIndex + 1} of {session.maxRounds}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  gameTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  playerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playerName: {
    color: 'white',
    fontWeight: '600',
  },
  roundText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 20,
  }
});
