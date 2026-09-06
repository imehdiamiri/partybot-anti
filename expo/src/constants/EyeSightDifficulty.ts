export type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  emoji: string;
  description: string;
  baseDigits: number;
  baseMs: number;
  /** Step (digits added every X rounds). Higher = faster ramp. */
  digitsPerStep: number;
  /** Ms shaved off per round. */
  msStep: number;
  /** Floor for display ms. */
  minMs: number;
  /** Cap for digit count. */
  maxDigits: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'easy',
    name: 'Easy',
    emoji: '🌱',
    description: '3 digits · 1.4s flash · gentle ramp',
    baseDigits: 3,
    baseMs: 1400,
    digitsPerStep: 3,
    msStep: 60,
    minMs: 700,
    maxDigits: 7,
  },
  {
    id: 'medium',
    name: 'Medium',
    emoji: '⚡',
    description: '3 digits · 1.0s flash · steady ramp',
    baseDigits: 3,
    baseMs: 1000,
    digitsPerStep: 2,
    msStep: 70,
    minMs: 500,
    maxDigits: 8,
  },
  {
    id: 'hard',
    name: 'Hard',
    emoji: '🔥',
    description: '4 digits · 0.7s flash · fast ramp',
    baseDigits: 4,
    baseMs: 700,
    digitsPerStep: 2,
    msStep: 60,
    minMs: 350,
    maxDigits: 9,
  },
  {
    id: 'expert',
    name: 'Expert',
    emoji: '👁️',
    description: '5 digits · 0.45s flash · brutal',
    baseDigits: 5,
    baseMs: 450,
    digitsPerStep: 2,
    msStep: 50,
    minMs: 220,
    maxDigits: 10,
  },
];
