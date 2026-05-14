import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameType } from '@/src/models/AppModels';
import { GameSession } from '@/src/store/useGameStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FirstTimeHintOverlay } from './FirstTimeHintOverlay';
import { GAME_HINTS } from '@/src/constants/GameHints';
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

interface Props {
  session: GameSession;
  game: GameType;
}

/** Renders the hint overlay (once per game) + the game session */
function withHint(gameId: string, child: React.ReactNode) {
  const hint = GAME_HINTS[gameId];
  return (
    <>
      {hint && <FirstTimeHintOverlay storageKey={`game_${gameId}`} icon={hint.icon} title={hint.title} tip={hint.tip} accent={hint.accent} />}
      {child}
    </>
  );
}

export function GameSessionRenderer({ session, game }: Props) {
  switch (game.id) {
    case 'reverse_singing':
      return withHint(game.id, <ReverseSingingSession session={session} />);
    case 'guess_the_seconds':
      return withHint(game.id, <GuessTheSecondsSession session={session} />);
    case 'imposter':
      return withHint(game.id, <ImposterSession session={session} />);
    case 'pass_guess':
      return withHint(game.id, <PassGuessSession session={session} />);
    case 'memory_grid':
      return withHint(game.id, <MemoryGridSession session={session} />);
    case 'memory_path':
      return withHint(game.id, <MemoryPathSession session={session} />);
    case 'tap_in_order':
      return withHint(game.id, <TapInOrderSession session={session} />);
    case 'ten_tangle':
      return withHint(game.id, <TenTangleSession session={session} />);
    case 'color_trap':
      return withHint(game.id, <ColorTrapSession session={session} />);
    case 'spin_bottle':
      return withHint(game.id, <SpinBottleSession session={session} />);
    case 'draw_rush':
      return withHint(game.id, <DrawRushSession session={session} />);
    case 'reaction_time':
      return withHint(game.id, <ReactionTimeSession session={session} />);
    case 'eye_sight':
      return withHint(game.id, <EyeSightSession session={session} />);
    case 'drum_challenge':
      return withHint(game.id, <DrumChallengeSession session={session} />);
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
