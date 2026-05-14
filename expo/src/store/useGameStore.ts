import { create } from 'zustand';
import { GameType, GameMode } from '@/src/models/AppModels';
import { Player, makeLocalPlayer } from '@/src/models/Player';

/**
 * @deprecated Use `Player` from `@/src/models/Player` directly.
 * Kept as an alias so existing imports keep compiling during migration.
 */
export type PlayerProfile = Player;

export enum MatchPhase {
  setup = 'setup',
  starting = 'starting',
  playing = 'playing',
  results = 'results',
  finished = 'finished'
}

export interface GameSession {
  id: string;
  game: GameType;
  mode: GameMode;
  roomCode?: string;
  players: Player[];
  currentRoundIndex: number;
  phase: MatchPhase;
  rounds?: any[];
  maxRounds?: number;
  gameConfig?: Record<string, any>;
}

interface GameStoreState {
  activeSession: GameSession | null;
  startSingleDeviceSession: (game: GameType, playerNames: string[], rounds: number, gameConfig?: Record<string, any>) => void;
  exitActiveSession: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  activeSession: null,
  
  startSingleDeviceSession: (game, playerNames, rounds, gameConfig) => {
    const players: Player[] = playerNames.map((name, index) => makeLocalPlayer(name, index));
    
    set({
      activeSession: {
        id: Math.random().toString(36).substring(7),
        game,
        mode: GameMode.singleDevice,
        players,
        currentRoundIndex: 0,
        phase: MatchPhase.playing,
        maxRounds: rounds,
        gameConfig,
      }
    });
  },
  
  exitActiveSession: () => {
    set({ activeSession: null });
  }
}));
