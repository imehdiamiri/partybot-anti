import { Colors } from '@/src/theme/Colors';
export enum GameMode {
  singleDevice = 'singleDevice',
  multiDevice = 'multiDevice',
  teamMode = 'teamMode',
}

export const GameModeDetails: Record<
  GameMode,
  { title: string; subtitle: string; icon: string; accentColor: string; shortLabel: string }
> = {
  [GameMode.singleDevice]: {
    title: '1 Phone',
    subtitle: 'Everyone plays on 1 phone',
    icon: 'smartphone', // SF: iphone.gen3
    accentColor: '#007AFF', // blue
    shortLabel: '1-D',
  },
  [GameMode.multiDevice]: {
    title: 'Multi Phone',
    subtitle: 'Everyone plays on their own phone',
    icon: 'iphone.radiowaves.left.and.right', // SF
    accentColor: Colors.green, // green
    shortLabel: 'Multi-D',
  },
  [GameMode.teamMode]: {
    title: 'Team Mode',
    subtitle: 'Split into 2 teams and compete',
    icon: 'person.2.wave.2.fill', // SF
    accentColor: '#AF52DE', // purple
    shortLabel: 'Team',
  },
};

export interface GameType {
  id: string;
  name: string;
  shortDescription: string;
  minPlayers: number;
  maxPlayers: number;
  unlockCostStars: number;
  isFreeForever: boolean;
  hasFreeTrial: boolean;
  isPremium: boolean;
  symbolName: string; // React Native / Expo vector icon mapping
  supportedModes: GameMode[];
  roundDuration: number;
  heroImageURL: string | null;
  /** Optional local require() asset for the hero image (takes precedence over URL). */
  heroImageLocal?: number;
}

export const Games: Record<string, GameType> = {
  reverseSinging: {
    id: 'reverse_singing',
    name: 'Reverse Singing',
    shortDescription: 'Pass the phone. Record anything. Hear it reversed. Mimic it. Compare the chaos.',
    minPlayers: 2,
    maxPlayers: 2,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'backward.fill', // SF: backward.fill
    supportedModes: [GameMode.singleDevice],
    roundDuration: 75,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/reverse-singing.png'),
  },
  guessTheSeconds: {
    id: 'guess_the_seconds',
    name: 'Guess the Seconds',
    shortDescription: 'Choose a target time, hide it, count in your head, then stop as close as you can.',
    minPlayers: 2,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'stopwatch.fill', // SF: stopwatch.fill
    // Real multiplayer is implemented via useGameSync (host-authoritative reducer).
    supportedModes: [GameMode.singleDevice, GameMode.multiDevice],
    roundDuration: 90,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/guess-the-seconds.png'),
  },
  tenTangle: {
    id: 'ten_tangle',
    name: 'Ten Tangle',
    shortDescription: 'Get a secret number 1–10, act it out for a scenario, and fool the guesser.',
    minPlayers: 3,
    maxPlayers: 11,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'theatermasks.fill', // SF: theatermasks.fill
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/ten-tangle.png'),
  },
  imposter: {
    id: 'imposter',
    name: 'Imposter',
    shortDescription: "One player is the Imposter — find them before it's too late, or bluff your way to victory.",
    minPlayers: 4,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'eye.fill', // SF: eye.fill
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/imposter.png'),
  },
  memoryGrid: {
    id: 'memory_grid',
    name: 'Memory Grid',
    shortDescription: 'Flip tiles, find matching pairs, and race the clock — or your friends.',
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'square.grid.3x3.fill', // SF: square.grid.3x3.fill
    // Real multiplayer only — team mode is not actually wired and was removed
    // to stop advertising fake flows.
    supportedModes: [GameMode.singleDevice, GameMode.multiDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/memory-grid.png'),
  },
  memoryPath: {
    id: 'memory_path',
    name: 'Memory Path',
    shortDescription: 'Find the hidden path from start to end — one wrong step and you restart.',
    minPlayers: 2,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'map.fill', // SF: map.fill
    // Single-device only until proper multi-device sync ships.
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/memory-path.png'),
  },
  tapInOrder: {
    id: 'tap_in_order',
    name: 'Tap in Order',
    shortDescription: 'Race against the clock to tap numbered tiles in order. Same board for every player.',
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'number.square.fill', // SF: number.square.fill -> roughly 123
    // Single-device only — multi-device sync not implemented for this game.
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/tap-in-order.png'),
  },
  colorTrap: {
    id: 'color_trap',
    name: 'Color Trap',
    shortDescription: "Tap every color except the forbidden one. Three strikes and you're out.",
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'paintpalette.fill', // SF: paintpalette.fill
    // Single-device only — multi-device sync not implemented for this game.
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/color-trap.png'),
  },
  passGuess: {
    id: 'pass_guess',
    name: 'Pass & Guess',
    shortDescription: 'Pass one phone, write private answers, then guess who wrote each one before the final reveal.',
    minPlayers: 2,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'text.bubble.fill', // SF: text.bubble.fill
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/pass-guess.png'),
  },
  spinBottle: {
    id: 'spin_bottle',
    name: 'Truth & Dare',
    shortDescription: 'Spin the bottle, get picked, and pick Truth or Dare. Classic party energy.',
    minPlayers: 3,
    maxPlayers: 12,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'arrow.triangle.2.circlepath', // SF: arrow.triangle.2.circlepath
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/spin-bottle.png'),
  },
  reactionTime: {
    id: 'reaction_time',
    name: 'Reaction Time',
    shortDescription: 'Wait for green, then tap as fast as you can. Lowest reaction time wins.',
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'bolt.fill',
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/reaction-time.png'),
  },
  eyeSight: {
    id: 'eye_sight',
    name: 'Eye Sight',
    shortDescription: 'Numbers flash for a split second — memorize them and type them back. Each round gets harder.',
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'eye.circle.fill',
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/eye-sight.png'),
  },
  drawRush: {
    id: 'draw_rush',
    name: 'Draw & Rush',
    shortDescription: 'One player draws a secret concept while everyone else rushes to guess what it is.',
    minPlayers: 2,
    maxPlayers: 12,
    unlockCostStars: 0,
    isFreeForever: false,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'pencil.and.scribble', // SF: pencil.and.scribble
    // Single-device only — the multi-device draft is not wired into useGameSync
    // and was removed from supported modes to avoid dead lobby flows.
    supportedModes: [GameMode.singleDevice],
    roundDuration: 100,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/draw-rush.png'),
  },
  drumChallenge: {
    id: 'drum_challenge',
    name: 'Drum Challenge',
    shortDescription: 'A music clip plays — tap the drum at the EXACT moment the beat drops. Closest to 0 ms wins.',
    minPlayers: 1,
    maxPlayers: 30,
    unlockCostStars: 0,
    isFreeForever: true,
    hasFreeTrial: false,
    isPremium: false,
    symbolName: 'music.note',
    supportedModes: [GameMode.singleDevice],
    roundDuration: 0,
    heroImageURL: null,
    heroImageLocal: require('@/assets/images/heroes/drum-challenge.png'),
  },
};

export const GameLibrary: GameType[] = [
  Games.reverseSinging,
  Games.guessTheSeconds,
  Games.imposter,
  Games.memoryGrid,
  Games.tenTangle,
  Games.memoryPath,
  Games.passGuess,
  Games.tapInOrder,
  Games.colorTrap,
  Games.drawRush,
  Games.spinBottle,
  Games.reactionTime,
  Games.eyeSight,
  Games.drumChallenge,
];

export interface GameDefinition {
  id: GameType;
  accentName: string;
}

export const GamesDefinitions: GameDefinition[] = [
  // ── Free games first ──
  { id: Games.reverseSinging, accentName: 'pink' },
  { id: Games.guessTheSeconds, accentName: 'cyan' },
  { id: Games.imposter, accentName: 'red' },
  { id: Games.memoryGrid, accentName: 'blue' },
  { id: Games.reactionTime, accentName: 'green' },
  { id: Games.eyeSight, accentName: 'cyan' },
  { id: Games.drumChallenge, accentName: 'pink' },
  // ── Premium games ──
  { id: Games.tenTangle, accentName: 'purple' },
  { id: Games.memoryPath, accentName: 'orange' },
  { id: Games.passGuess, accentName: 'yellow' },
  { id: Games.tapInOrder, accentName: 'teal' },
  { id: Games.colorTrap, accentName: 'red' },
  { id: Games.drawRush, accentName: 'blue' },
  { id: Games.spinBottle, accentName: 'purple' },
];

export const getPlayerCountText = (min: number, max: number): string => `${min}–${max} players`;
