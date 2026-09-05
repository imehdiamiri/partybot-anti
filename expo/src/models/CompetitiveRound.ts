export type CompetitiveRoundPhase = 'waiting' | 'countdown' | 'playing' | 'results';

export interface PlayerRoundResult {
  playerId: string;
  displayName: string;
  score: number; // Primary numeric score for ranking (lower ms is better for Reaction Time, Tap in Order & Memory Grid)
  secondaryScore?: number; // e.g. missTaps count for Tap, move count for Memory Grid
  completedAt: number; // Server-aligned timestamp in ms
  didFinish: boolean; // false for DNF / foul / timeout / quit
  details?: Record<string, any>;
}

export interface CompetitiveRoundState {
  roundId: string;
  gameId: string;
  phase: CompetitiveRoundPhase;
  scheduledStartAt: number; // Server-aligned start timestamp in ms (e.g. now + 5000)
  scheduledEndsAt: number; // Server-aligned deadline timestamp in ms
  seed: number; // Deterministic random seed
  goAtTimestamp?: number; // Server-aligned timestamp for Reaction Time green flash
  previewEndTimestamp?: number; // Server-aligned timestamp for Tap in Order preview end
  participantIds: string[]; // Frozen list of participant player IDs
  participantNames: Record<string, string>; // Frozen map of participant display names
  roundConfig?: Record<string, any>; // Host-frozen round configuration (e.g. cols, rows, gridSize)
  results: Record<string, PlayerRoundResult>;
  isFinalized: boolean;
  version: number;
}

export interface SubmitResultActionPayload {
  roundId: string;
  result: Omit<PlayerRoundResult, 'playerId' | 'displayName'>;
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBMISSION STATE MACHINE & LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

export type SubmissionStatus = 'idle' | 'sending' | 'delivered' | 'error' | 'accepted';

export interface SubmissionMachineState {
  status: SubmissionStatus;
  pendingResult: PlayerRoundResult | null;
  error: string | null;
  activeRoundId: string | null;
  inFlightRoundId: string | null;
}

export function createInitialSubmissionState(roundId: string | null = null): SubmissionMachineState {
  return {
    status: 'idle',
    pendingResult: null,
    error: null,
    activeRoundId: roundId,
    inFlightRoundId: null,
  };
}

export function canSubmitResult(
  state: SubmissionMachineState,
  roundId: string,
  isAcceptedByHost: boolean
): boolean {
  if (isAcceptedByHost) return false;
  if (state.inFlightRoundId === roundId) return false;
  if (state.status === 'sending' || state.status === 'delivered' || state.status === 'accepted') {
    return false;
  }
  return true;
}

export function startResultSubmission(
  state: SubmissionMachineState,
  roundId: string,
  fullResult: PlayerRoundResult
): SubmissionMachineState {
  return {
    ...state,
    status: 'sending',
    pendingResult: fullResult,
    error: null,
    activeRoundId: roundId,
    inFlightRoundId: roundId,
  };
}

export function markResultDelivered(state: SubmissionMachineState): SubmissionMachineState {
  return {
    ...state,
    status: 'delivered',
    error: null,
  };
}

export function markResultAccepted(state: SubmissionMachineState): SubmissionMachineState {
  return {
    ...state,
    status: 'accepted',
    error: null,
  };
}

export function markResultFailed(
  state: SubmissionMachineState,
  errorMessage: string
): SubmissionMachineState {
  return {
    ...state,
    status: 'error',
    error: errorMessage,
    inFlightRoundId: null, // Clears in-flight lock to allow retry
  };
}

export function canRetrySubmission(
  state: SubmissionMachineState,
  roundId: string,
  isAcceptedByHost: boolean
): boolean {
  if (isAcceptedByHost) return false;
  if (!state.pendingResult) return false;
  if (state.status !== 'error') return false;
  if (state.inFlightRoundId === roundId) return false;
  return true;
}

export function startResultRetry(
  state: SubmissionMachineState,
  roundId: string
): { nextState: SubmissionMachineState; payloadToResend: PlayerRoundResult | null } {
  if (!state.pendingResult) {
    return { nextState: state, payloadToResend: null };
  }
  const nextState: SubmissionMachineState = {
    ...state,
    status: 'sending',
    error: null,
    inFlightRoundId: roundId,
  };
  return { nextState, payloadToResend: state.pendingResult };
}

// ══════════════════════════════════════════════════════════════════════════════
// PRNG & DETERMINISTIC BOARDS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 32-bit Mulberry PRNG for fast deterministic pseudo-random sequences.
 */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a deterministic numbered tile board for Tap in Order from a seed.
 */
export function generateDeterministicTapBoard(gridSize: number, tileCount: number, seed: number) {
  const rng = mulberry32(seed);
  const totalCells = gridSize * gridSize;
  const allIndices = Array.from({ length: totalCells }, (_, i) => i);

  // Seeded Fisher-Yates shuffle
  for (let i = allIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = allIndices[i];
    allIndices[i] = allIndices[j];
    allIndices[j] = temp;
  }

  const selectedCells = allIndices.slice(0, tileCount);
  const numberForCell: Record<number, number> = {};
  selectedCells.forEach((cell, idx) => {
    numberForCell[cell] = idx + 1;
  });

  return { selectedCells, numberForCell };
}

export const MEMORY_GRID_SYMBOLS: string[] = [
  'star.fill', 'heart.fill', 'moon.fill', 'sun.max.fill',
  'bolt.fill', 'flame.fill', 'leaf.fill', 'drop.fill',
  'snowflake', 'cloud.fill', 'wind', 'tornado',
  'sparkles', 'bell.fill', 'flag.fill', 'crown.fill',
  'diamond.fill', 'globe.americas.fill'
];

export interface DeterministicMemoryTile {
  id: string;
  pairId: number;
  symbol: string;
  colorIndex: number;
  isFlipped: boolean;
  isMatched: boolean;
}

/**
 * Generates a deterministic memory tile board for Memory Grid from grid dimensions and a seed.
 */
export function generateDeterministicMemoryGridBoard(
  cols: number,
  rows: number,
  seed: number
): DeterministicMemoryTile[] {
  const rng = mulberry32(seed);
  const pairCount = Math.floor((cols * rows) / 2);

  // Seeded Fisher-Yates shuffle helper
  function seededShuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }

  const chosenSymbols = seededShuffle(MEMORY_GRID_SYMBOLS).slice(0, pairCount);
  const tiles: DeterministicMemoryTile[] = [];

  for (let pairId = 0; pairId < chosenSymbols.length; pairId++) {
    const colorIndex = pairId % 10;
    tiles.push({
      id: `a_${pairId}`,
      pairId,
      symbol: chosenSymbols[pairId],
      colorIndex,
      isFlipped: false,
      isMatched: false,
    });
    tiles.push({
      id: `b_${pairId}`,
      pairId,
      symbol: chosenSymbols[pairId],
      colorIndex,
      isFlipped: false,
      isMatched: false,
    });
  }

  return seededShuffle(tiles);
}

/**
 * Extracts validated grid dimensions from authoritative roundState or falls back to defaults.
 */
export function getAuthoritativeGridDims(
  roundState: CompetitiveRoundState | null | undefined,
  fallbackCols: number = 3,
  fallbackRows: number = 4
): { cols: number; rows: number } {
  if (roundState?.roundConfig?.cols && roundState?.roundConfig?.rows) {
    const c = Number(roundState.roundConfig.cols);
    const r = Number(roundState.roundConfig.rows);
    if (!isNaN(c) && !isNaN(r) && c > 0 && r > 0) {
      return { cols: c, rows: r };
    }
  }
  return { cols: fallbackCols, rows: fallbackRows };
}

/**
 * Computes deterministic ranking for Reaction Time results.
 * Rank rules:
 * 1. Valid finished attempts (didFinish = true) always rank above fouls / DNF (didFinish = false).
 * 2. Lower reaction time in ms wins.
 * 3. Tie breaker: earlier completedAt timestamp, then alphabetical playerId.
 */
export function rankReactionTimeResults(
  results: Record<string, PlayerRoundResult>,
  allPlayerIds: string[],
  playerNames: Record<string, string>
): PlayerRoundResult[] {
  const resultList: PlayerRoundResult[] = allPlayerIds.map(pid => {
    if (results[pid]) return results[pid];
    return {
      playerId: pid,
      displayName: playerNames[pid] || 'Player',
      score: 99999,
      completedAt: Date.now(),
      didFinish: false,
    };
  });

  return resultList.sort((a, b) => {
    // 1. Finished vs DNF
    if (a.didFinish !== b.didFinish) {
      return a.didFinish ? -1 : 1;
    }
    // 2. Both finished: lowest score (ms) wins
    if (a.didFinish && b.didFinish) {
      if (a.score !== b.score) return a.score - b.score;
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
      return a.playerId.localeCompare(b.playerId);
    }
    // 3. Both DNF: tie break by playerId
    return a.playerId.localeCompare(b.playerId);
  });
}

/**
 * Computes deterministic ranking for Tap in Order results.
 * Rank rules:
 * 1. Valid finished runs (didFinish = true) always rank above DNF.
 * 2. Lower total time in ms wins.
 * 3. Fewer missTaps (secondaryScore) wins.
 * 4. Tie breaker: earlier completedAt timestamp, then alphabetical playerId.
 */
export function rankTapInOrderResults(
  results: Record<string, PlayerRoundResult>,
  allPlayerIds: string[],
  playerNames: Record<string, string>
): PlayerRoundResult[] {
  const resultList: PlayerRoundResult[] = allPlayerIds.map(pid => {
    if (results[pid]) return results[pid];
    return {
      playerId: pid,
      displayName: playerNames[pid] || 'Player',
      score: 999999,
      secondaryScore: 999,
      completedAt: Date.now(),
      didFinish: false,
    };
  });

  return resultList.sort((a, b) => {
    // 1. Finished vs DNF
    if (a.didFinish !== b.didFinish) {
      return a.didFinish ? -1 : 1;
    }
    // 2. Both finished
    if (a.didFinish && b.didFinish) {
      if (a.score !== b.score) return a.score - b.score;
      const aMiss = a.secondaryScore ?? 0;
      const bMiss = b.secondaryScore ?? 0;
      if (aMiss !== bMiss) return aMiss - bMiss;
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
      return a.playerId.localeCompare(b.playerId);
    }
    // 3. Both DNF
    return a.playerId.localeCompare(b.playerId);
  });
}

/**
 * Computes deterministic ranking for Memory Grid results.
 * Rank rules:
 * 1. Valid finished runs (didFinish = true) always rank above DNF.
 * 2. Lower elapsed time in ms (score) wins.
 * 3. Fewer moves (secondaryScore) wins.
 * 4. Tie breaker: earlier completedAt timestamp, then alphabetical playerId.
 */
export function rankMemoryGridResults(
  results: Record<string, PlayerRoundResult>,
  allPlayerIds: string[],
  playerNames: Record<string, string>
): PlayerRoundResult[] {
  const resultList: PlayerRoundResult[] = allPlayerIds.map(pid => {
    if (results[pid]) return results[pid];
    return {
      playerId: pid,
      displayName: playerNames[pid] || 'Player',
      score: 999999,
      secondaryScore: 999,
      completedAt: Date.now(),
      didFinish: false,
    };
  });

  return resultList.sort((a, b) => {
    // 1. Finished vs DNF
    if (a.didFinish !== b.didFinish) {
      return a.didFinish ? -1 : 1;
    }
    // 2. Both finished: lowest score (elapsed ms) wins, then fewer moves (secondaryScore)
    if (a.didFinish && b.didFinish) {
      if (a.score !== b.score) return a.score - b.score;
      const aMoves = a.secondaryScore ?? 0;
      const bMoves = b.secondaryScore ?? 0;
      if (aMoves !== bMoves) return aMoves - bMoves;
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
      return a.playerId.localeCompare(b.playerId);
    }
    // 3. Both DNF
    return a.playerId.localeCompare(b.playerId);
  });
}

/**
 * Calculates live client phase from host-authoritative timestamps.
 */
export function computeClientPhase(
  round: CompetitiveRoundState | null,
  currentTimestamp: number = Date.now()
): {
  phase: CompetitiveRoundPhase;
  countdownSeconds: number;
  hasExpired: boolean;
} {
  if (!round) {
    return { phase: 'waiting', countdownSeconds: 0, hasExpired: false };
  }

  if (round.phase === 'results' || round.isFinalized) {
    return { phase: 'results', countdownSeconds: 0, hasExpired: false };
  }

  if (currentTimestamp < round.scheduledStartAt) {
    const remainingMs = round.scheduledStartAt - currentTimestamp;
    const countdownSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    return { phase: 'countdown', countdownSeconds, hasExpired: false };
  }

  if (round.scheduledEndsAt && currentTimestamp >= round.scheduledEndsAt) {
    return { phase: 'results', countdownSeconds: 0, hasExpired: true };
  }

  return { phase: 'playing', countdownSeconds: 0, hasExpired: false };
}

/**
 * Host Action Reducer: validates and applies client actions idempotently and securely.
 */
export function reduceCompetitiveRoundAction(
  state: CompetitiveRoundState,
  actionType: string,
  data: any,
  senderPlayerId: string
): CompetitiveRoundState {
  if (actionType !== 'SUBMIT_RESULT') {
    return state;
  }

  if (state.isFinalized) {
    return state;
  }

  const payload = data as SubmitResultActionPayload;
  if (!payload || !payload.roundId || payload.roundId !== state.roundId) {
    // Reject stale or mismatched round submission
    return state;
  }

  if (!state.participantIds || !state.participantIds.includes(senderPlayerId)) {
    // Reject submissions from non-participants
    return state;
  }

  if (state.results && state.results[senderPlayerId]) {
    // Idempotent: ignore duplicate submission
    return state;
  }

  const incoming = payload.result;
  if (!incoming || typeof incoming.score !== 'number') {
    return state;
  }

  // Derive displayName strictly from frozen participantNames map; discard untrusted client values
  const verifiedResult: PlayerRoundResult = {
    score: incoming.score,
    secondaryScore: incoming.secondaryScore,
    completedAt: incoming.completedAt || Date.now(),
    didFinish: !!incoming.didFinish,
    details: incoming.details,
    playerId: senderPlayerId,
    displayName: state.participantNames?.[senderPlayerId] || 'Player',
  };

  const nextResults = {
    ...(state.results || {}),
    [senderPlayerId]: verifiedResult,
  };

  const allSubmitted =
    state.participantIds.length > 0 &&
    state.participantIds.every(pid => nextResults[pid] !== undefined);

  return {
    ...state,
    results: nextResults,
    phase: allSubmitted ? 'results' : state.phase,
    isFinalized: allSubmitted,
    version: (state.version || 1) + 1,
  };
}

/**
 * Finalizes the round when deadline expires, creating DNF records for missing participants.
 */
export function finalizeRoundWithDNF(
  state: CompetitiveRoundState,
  now: number
): CompetitiveRoundState {
  if (state.isFinalized) return state;

  const nextResults = { ...(state.results || {}) };
  for (const pid of state.participantIds || []) {
    if (!nextResults[pid]) {
      nextResults[pid] = {
        playerId: pid,
        displayName: state.participantNames?.[pid] || 'Player',
        score: state.gameId === 'reaction_time' ? 99999 : 999999,
        secondaryScore: (state.gameId === 'tap_in_order' || state.gameId === 'memory_grid') ? 999 : undefined,
        completedAt: now,
        didFinish: false,
      };
    }
  }

  return {
    ...state,
    results: nextResults,
    phase: 'results',
    isFinalized: true,
    version: (state.version || 1) + 1,
  };
}
