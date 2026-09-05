import {
  mulberry32,
  generateDeterministicTapBoard,
  generateDeterministicMemoryGridBoard,
  rankReactionTimeResults,
  rankTapInOrderResults,
  rankMemoryGridResults,
  getAuthoritativeGridDims,
  computeClientPhase,
  reduceCompetitiveRoundAction,
  finalizeRoundWithDNF,
  CompetitiveRoundState,
  PlayerRoundResult,
  createInitialSubmissionState,
  canSubmitResult,
  startResultSubmission,
  markResultDelivered,
  markResultAccepted,
  markResultFailed,
  canRetrySubmission,
  startResultRetry,
} from '../models/CompetitiveRound';
import { serverClock, getServerNow } from '../services/ServerClock';

describe('CompetitiveRound Logic & Deterministic Multiplayer', () => {
  describe('Mulberry32 PRNG and Deterministic Tap Board Generation', () => {
    it('produces identical deterministic boards for the same seed across multiple calls', () => {
      const seed = 428912;
      const boardA = generateDeterministicTapBoard(5, 8, seed);
      const boardB = generateDeterministicTapBoard(5, 8, seed);

      expect(boardA.selectedCells).toEqual(boardB.selectedCells);
      expect(boardA.numberForCell).toEqual(boardB.numberForCell);
      expect(boardA.selectedCells.length).toBe(8);
    });

    it('produces different boards for different seeds', () => {
      const board1 = generateDeterministicTapBoard(5, 8, 12345);
      const board2 = generateDeterministicTapBoard(5, 8, 67890);

      expect(board1.selectedCells).not.toEqual(board2.selectedCells);
    });

    it('ensures all numbers 1 through tileCount are mapped without gaps or duplicates', () => {
      const { selectedCells, numberForCell } = generateDeterministicTapBoard(5, 10, 999);
      const values = Object.values(numberForCell).sort((a, b) => a - b);

      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      selectedCells.forEach(cell => {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(25);
      });
    });
  });

  describe('Reaction Time Deterministic Ranking', () => {
    const playerIds = ['player_a', 'player_b', 'player_c', 'player_d'];
    const names = {
      player_a: 'Alice',
      player_b: 'Bob',
      player_c: 'Charlie',
      player_d: 'David',
    };

    it('ranks valid attempts by lowest reaction time (ms)', () => {
      const results: Record<string, PlayerRoundResult> = {
        player_a: { playerId: 'player_a', displayName: 'Alice', score: 280, completedAt: 1000, didFinish: true },
        player_b: { playerId: 'player_b', displayName: 'Bob', score: 195, completedAt: 1010, didFinish: true },
        player_c: { playerId: 'player_c', displayName: 'Charlie', score: 340, completedAt: 1020, didFinish: true },
      };

      const ranked = rankReactionTimeResults(results, playerIds, names);

      expect(ranked[0].playerId).toBe('player_b'); // 195 ms
      expect(ranked[1].playerId).toBe('player_a'); // 280 ms
      expect(ranked[2].playerId).toBe('player_c'); // 340 ms
      expect(ranked[3].playerId).toBe('player_d'); // DNF
      expect(ranked[3].didFinish).toBe(false);
    });

    it('places fouls and DNFs below all valid finishes', () => {
      const results: Record<string, PlayerRoundResult> = {
        player_a: { playerId: 'player_a', displayName: 'Alice', score: 99999, completedAt: 1000, didFinish: false }, // Foul
        player_b: { playerId: 'player_b', displayName: 'Bob', score: 450, completedAt: 1050, didFinish: true },
      };

      const ranked = rankReactionTimeResults(results, ['player_a', 'player_b'], names);

      expect(ranked[0].playerId).toBe('player_b');
      expect(ranked[0].didFinish).toBe(true);
      expect(ranked[1].playerId).toBe('player_a');
      expect(ranked[1].didFinish).toBe(false);
    });

    it('breaks ties deterministically using earlier completedAt timestamp, then playerId', () => {
      const results: Record<string, PlayerRoundResult> = {
        player_a: { playerId: 'player_a', displayName: 'Alice', score: 220, completedAt: 2000, didFinish: true },
        player_b: { playerId: 'player_b', displayName: 'Bob', score: 220, completedAt: 1500, didFinish: true },
      };

      const ranked = rankReactionTimeResults(results, ['player_a', 'player_b'], names);

      expect(ranked[0].playerId).toBe('player_b'); // Earlier completedAt
      expect(ranked[1].playerId).toBe('player_a');
    });
  });

  describe('Tap in Order Deterministic Ranking', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const names = { p1: 'Player 1', p2: 'Player 2', p3: 'Player 3', p4: 'Player 4' };

    it('ranks completed runs by lowest total score (time + penalties)', () => {
      const results: Record<string, PlayerRoundResult> = {
        p1: { playerId: 'p1', displayName: 'Player 1', score: 8500, secondaryScore: 0, completedAt: 5000, didFinish: true },
        p2: { playerId: 'p2', displayName: 'Player 2', score: 6200, secondaryScore: 1, completedAt: 5100, didFinish: true },
        p3: { playerId: 'p3', displayName: 'Player 3', score: 12000, secondaryScore: 2, completedAt: 5200, didFinish: true },
      };

      const ranked = rankTapInOrderResults(results, playerIds, names);

      expect(ranked[0].playerId).toBe('p2'); // 6200 ms
      expect(ranked[1].playerId).toBe('p1'); // 8500 ms
      expect(ranked[2].playerId).toBe('p3'); // 12000 ms
      expect(ranked[3].playerId).toBe('p4'); // DNF
    });

    it('breaks ties with fewer missTaps if total score matches', () => {
      const results: Record<string, PlayerRoundResult> = {
        p1: { playerId: 'p1', displayName: 'Player 1', score: 7000, secondaryScore: 2, completedAt: 4000, didFinish: true },
        p2: { playerId: 'p2', displayName: 'Player 2', score: 7000, secondaryScore: 0, completedAt: 4100, didFinish: true },
      };

      const ranked = rankTapInOrderResults(results, ['p1', 'p2'], names);

      expect(ranked[0].playerId).toBe('p2'); // 0 misses vs 2 misses
      expect(ranked[1].playerId).toBe('p1');
    });

    it('ranks DNF / gave up runs after all completed runs', () => {
      const results: Record<string, PlayerRoundResult> = {
        p1: { playerId: 'p1', displayName: 'Player 1', score: 999999, secondaryScore: 0, completedAt: 1000, didFinish: false },
        p2: { playerId: 'p2', displayName: 'Player 2', score: 15000, secondaryScore: 3, completedAt: 2000, didFinish: true },
      };

      const ranked = rankTapInOrderResults(results, ['p1', 'p2'], names);

      expect(ranked[0].playerId).toBe('p2');
      expect(ranked[1].playerId).toBe('p1');
    });
  });

  describe('Server-Aligned Phase and Countdown Calculation', () => {
    const baseRound: CompetitiveRoundState = {
      roundId: 'round_100',
      gameId: 'reaction_time',
      phase: 'countdown',
      scheduledStartAt: 10000,
      scheduledEndsAt: 40000,
      seed: 5555,
      participantIds: ['host_uid', 'guest_uid'],
      participantNames: { host_uid: 'Host', guest_uid: 'Guest' },
      results: {},
      isFinalized: false,
      version: 1,
    };

    it('returns waiting for null round', () => {
      expect(computeClientPhase(null, 5000)).toEqual({
        phase: 'waiting',
        countdownSeconds: 0,
        hasExpired: false,
      });
    });

    it('returns countdown when current time is before scheduledStartAt', () => {
      const calc1 = computeClientPhase(baseRound, 6000); // 4000ms left -> 4s
      expect(calc1.phase).toBe('countdown');
      expect(calc1.countdownSeconds).toBe(4);

      const calc2 = computeClientPhase(baseRound, 9100); // 900ms left -> 1s
      expect(calc2.phase).toBe('countdown');
      expect(calc2.countdownSeconds).toBe(1);
    });

    it('returns playing when current time is between start and deadline', () => {
      const calc = computeClientPhase(baseRound, 15000);
      expect(calc.phase).toBe('playing');
      expect(calc.countdownSeconds).toBe(0);
      expect(calc.hasExpired).toBe(false);
    });

    it('returns results and marks expired when deadline passes', () => {
      const calc = computeClientPhase(baseRound, 45000);
      expect(calc.phase).toBe('results');
      expect(calc.hasExpired).toBe(true);
    });

    it('returns results immediately if round is finalized', () => {
      const finalizedRound = { ...baseRound, isFinalized: true, phase: 'results' as const };
      const calc = computeClientPhase(finalizedRound, 8000);
      expect(calc.phase).toBe('results');
    });
  });

  describe('ServerClock & Time Offset Synchronization', () => {
    afterEach(() => {
      serverClock.setOffset(0);
    });

    it('applies server time offset correctly to estimated server time', () => {
      const localNow = Date.now();
      serverClock.setOffset(3500); // Server is 3.5s ahead

      const estNow = getServerNow();
      expect(estNow).toBeGreaterThanOrEqual(localNow + 3490);
      expect(estNow).toBeLessThanOrEqual(localNow + 3550);
    });
  });

  describe('Host Action Reducer: Security, Idempotency & Sender Binding', () => {
    const roundState: CompetitiveRoundState = {
      roundId: 'round_valid_123',
      gameId: 'reaction_time',
      phase: 'playing',
      scheduledStartAt: 5000,
      scheduledEndsAt: 35000,
      seed: 8888,
      participantIds: ['user_host', 'user_guest'],
      participantNames: {
        user_host: 'Host Player',
        user_guest: 'Guest Player',
      },
      results: {},
      isFinalized: false,
      version: 1,
    };

    it('accepts valid guest submission and derives displayName from frozen participantNames', () => {
      const actionData = {
        roundId: 'round_valid_123',
        result: {
          score: 240,
          completedAt: 12000,
          didFinish: true,
        },
      };

      const nextState = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        actionData,
        'user_guest'
      );

      expect(nextState.results['user_guest']).toBeDefined();
      expect(nextState.results['user_guest'].playerId).toBe('user_guest');
      expect(nextState.results['user_guest'].displayName).toBe('Guest Player');
      expect(nextState.results['user_guest'].score).toBe(240);
      expect(nextState.isFinalized).toBe(false); // Host has not submitted yet
    });

    it('rejects submissions with mismatched or stale roundId', () => {
      const staleAction = {
        roundId: 'round_stale_999',
        result: { score: 200, completedAt: 10000, didFinish: true },
      };

      const nextState = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        staleAction,
        'user_guest'
      );

      expect(nextState.results['user_guest']).toBeUndefined();
      expect(nextState.version).toBe(1);
    });

    it('rejects submissions from non-participants', () => {
      const outsiderAction = {
        roundId: 'round_valid_123',
        result: { score: 180, completedAt: 11000, didFinish: true },
      };

      const nextState = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        outsiderAction,
        'unauthorized_intruder'
      );

      expect(nextState.results['unauthorized_intruder']).toBeUndefined();
      expect(nextState.version).toBe(1);
    });

    it('ignores spoofed playerId/displayName in client payload and binds strictly to senderPlayerId', () => {
      const spoofAction = {
        roundId: 'round_valid_123',
        result: {
          playerId: 'user_host', // Trying to overwrite host!
          displayName: 'Spoofed Name',
          score: 9999,
          completedAt: 12000,
          didFinish: false,
        },
      };

      const nextState = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        spoofAction,
        'user_guest' // Actual sender is guest
      );

      expect(nextState.results['user_host']).toBeUndefined(); // Host remains untouched
      expect(nextState.results['user_guest']).toBeDefined();
      expect(nextState.results['user_guest'].displayName).toBe('Guest Player');
    });

    it('idempotently ignores duplicate submissions from the same player', () => {
      const firstAction = {
        roundId: 'round_valid_123',
        result: { score: 250, completedAt: 12000, didFinish: true },
      };

      const stateWithGuest = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        firstAction,
        'user_guest'
      );

      const duplicateAction = {
        roundId: 'round_valid_123',
        result: { score: 100, completedAt: 13000, didFinish: true },
      };

      const secondState = reduceCompetitiveRoundAction(
        stateWithGuest,
        'SUBMIT_RESULT',
        duplicateAction,
        'user_guest'
      );

      expect(secondState.results['user_guest'].score).toBe(250); // Original score preserved
      expect(secondState.version).toBe(stateWithGuest.version);
    });

    it('finalizes round and sets phase to results when all frozen participants have submitted', () => {
      let state = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        { roundId: 'round_valid_123', result: { score: 220, completedAt: 12000, didFinish: true } },
        'user_guest'
      );
      expect(state.isFinalized).toBe(false);

      state = reduceCompetitiveRoundAction(
        state,
        'SUBMIT_RESULT',
        { roundId: 'round_valid_123', result: { score: 260, completedAt: 12500, didFinish: true } },
        'user_host'
      );

      expect(state.isFinalized).toBe(true);
      expect(state.phase).toBe('results');
    });
  });

  describe('Deadline and DNF Finalization', () => {
    it('creates DNF entries for non-submitting participants without overwriting submitted results', () => {
      const partialState: CompetitiveRoundState = {
        roundId: 'round_partial',
        gameId: 'reaction_time',
        phase: 'playing',
        scheduledStartAt: 5000,
        scheduledEndsAt: 25000,
        seed: 1234,
        participantIds: ['player_1', 'player_2', 'player_3'],
        participantNames: {
          player_1: 'P1',
          player_2: 'P2',
          player_3: 'P3',
        },
        results: {
          player_1: { playerId: 'player_1', displayName: 'P1', score: 210, completedAt: 10000, didFinish: true },
        },
        isFinalized: false,
        version: 2,
      };

      const finalized = finalizeRoundWithDNF(partialState, 26000);

      expect(finalized.isFinalized).toBe(true);
      expect(finalized.phase).toBe('results');
      expect(finalized.results['player_1'].score).toBe(210);
      expect(finalized.results['player_1'].didFinish).toBe(true);
      expect(finalized.results['player_2'].didFinish).toBe(false);
      expect(finalized.results['player_3'].didFinish).toBe(false);
    });
  });

  describe('Multiplayer Two-Client State Normalization & Replayability', () => {
    it('normalizes isLocal and isHost per device from canonical localPlayerId', () => {
      const rtdbPlayers = {
        host_uid: { id: 'host_uid', displayName: 'Alice', isHost: true, isLocal: false },
        guest_uid: { id: 'guest_uid', displayName: 'Bob', isHost: false, isLocal: false },
      };

      // On Host device
      const hostNormalized = Object.values(rtdbPlayers).map(p => ({
        ...p,
        isLocal: p.id === 'host_uid',
        isHost: p.id === 'host_uid',
      }));
      expect(hostNormalized.find(p => p.id === 'host_uid')?.isLocal).toBe(true);
      expect(hostNormalized.find(p => p.id === 'guest_uid')?.isLocal).toBe(false);

      // On Guest device
      const guestNormalized = Object.values(rtdbPlayers).map(p => ({
        ...p,
        isLocal: p.id === 'guest_uid',
        isHost: p.id === 'host_uid',
      }));
      expect(guestNormalized.find(p => p.id === 'host_uid')?.isLocal).toBe(false);
      expect(guestNormalized.find(p => p.id === 'guest_uid')?.isLocal).toBe(true);
      expect(guestNormalized.find(p => p.id === 'host_uid')?.isHost).toBe(true);
    });

    it('resets submitted state and prepares clean round when host generates a new roundId', () => {
      const round1: CompetitiveRoundState = {
        roundId: 'round_1',
        gameId: 'tap_in_order',
        phase: 'results',
        scheduledStartAt: 5000,
        scheduledEndsAt: 30000,
        seed: 1111,
        participantIds: ['host_uid', 'guest_uid'],
        participantNames: { host_uid: 'Host', guest_uid: 'Guest' },
        results: {
          host_uid: { playerId: 'host_uid', displayName: 'Host', score: 5000, completedAt: 10000, didFinish: true },
          guest_uid: { playerId: 'guest_uid', displayName: 'Guest', score: 5500, completedAt: 10500, didFinish: true },
        },
        isFinalized: true,
        version: 3,
      };

      // Host triggers playAgain -> generates round 2
      const round2: CompetitiveRoundState = {
        roundId: 'round_2',
        gameId: 'tap_in_order',
        phase: 'countdown',
        scheduledStartAt: 40000,
        scheduledEndsAt: 75000,
        seed: 2222,
        participantIds: ['host_uid', 'guest_uid'],
        participantNames: { host_uid: 'Host', guest_uid: 'Guest' },
        results: {},
        isFinalized: false,
        version: 1,
      };

      expect(round2.roundId).not.toEqual(round1.roundId);
      expect(round2.results).toEqual({});
      expect(round2.isFinalized).toBe(false);
      expect(round2.seed).not.toEqual(round1.seed);
    });
  });

  describe('Submission State Machine & Retry Safety', () => {
    const roundId = 'round_test_100';
    const sampleResult: PlayerRoundResult = {
      playerId: 'player_123',
      displayName: 'Alice',
      score: 250,
      completedAt: 10500,
      didFinish: true,
      details: { foo: 'bar' },
    };
    const giveUpResult: PlayerRoundResult = {
      playerId: 'player_123',
      displayName: 'Alice',
      score: 999999,
      secondaryScore: 2,
      completedAt: 12000,
      didFinish: false,
      details: { rawTimeMs: 12000, missTaps: 2, correctCount: 5 },
    };

    it('initializes in idle state with no pending result', () => {
      const state = createInitialSubmissionState(roundId);
      expect(state.status).toBe('idle');
      expect(state.pendingResult).toBeNull();
      expect(state.error).toBeNull();
      expect(state.inFlightRoundId).toBeNull();
      expect(canSubmitResult(state, roundId, false)).toBe(true);
    });

    it('blocks rapid double submissions synchronously in the same render tick', () => {
      let state = createInitialSubmissionState(roundId);
      expect(canSubmitResult(state, roundId, false)).toBe(true);

      state = startResultSubmission(state, roundId, sampleResult);
      expect(state.status).toBe('sending');
      expect(state.inFlightRoundId).toBe(roundId);

      // Second immediate call in same tick is blocked
      expect(canSubmitResult(state, roundId, false)).toBe(false);
    });

    it('transitions to delivered on successful transport write', () => {
      let state = createInitialSubmissionState(roundId);
      state = startResultSubmission(state, roundId, sampleResult);
      state = markResultDelivered(state);

      expect(state.status).toBe('delivered');
      expect(state.error).toBeNull();
      expect(canSubmitResult(state, roundId, false)).toBe(false);
    });

    it('transitions to error, unlocks retry, and preserves original payload on transport failure', () => {
      let state = createInitialSubmissionState(roundId);
      state = startResultSubmission(state, roundId, sampleResult);
      state = markResultFailed(state, 'Network timeout');

      expect(state.status).toBe('error');
      expect(state.error).toBe('Network timeout');
      expect(state.inFlightRoundId).toBeNull(); // Unlocked!
      expect(state.pendingResult).toEqual(sampleResult);
      expect(canRetrySubmission(state, roundId, false)).toBe(true);
    });

    it('retries resending the exact original payload without recalculating timestamps or scores', () => {
      let state = createInitialSubmissionState(roundId);
      state = startResultSubmission(state, roundId, sampleResult);
      state = markResultFailed(state, 'Connection failed');

      const { nextState, payloadToResend } = startResultRetry(state, roundId);

      expect(nextState.status).toBe('sending');
      expect(nextState.inFlightRoundId).toBe(roundId);
      expect(payloadToResend).toEqual(sampleResult);
      expect(payloadToResend!.completedAt).toBe(sampleResult.completedAt);
      expect(payloadToResend!.score).toBe(sampleResult.score);
      expect(payloadToResend!.didFinish).toBe(true);
    });

    it('preserves Give Up (didFinish = false) exactly when retrying a failed Give Up submission', () => {
      let state = createInitialSubmissionState(roundId);
      state = startResultSubmission(state, roundId, giveUpResult);
      state = markResultFailed(state, 'Firebase offline');

      const { nextState, payloadToResend } = startResultRetry(state, roundId);

      expect(nextState.status).toBe('sending');
      expect(payloadToResend).toEqual(giveUpResult);
      expect(payloadToResend!.didFinish).toBe(false);
      expect(payloadToResend!.score).toBe(999999);
      expect(payloadToResend!.secondaryScore).toBe(2);
      expect(payloadToResend!.completedAt).toBe(12000);
      expect(payloadToResend!.details?.correctCount).toBe(5);
    });

    it('prevents submission or retry once the result has been accepted by host in snapshot', () => {
      let state = createInitialSubmissionState(roundId);
      state = startResultSubmission(state, roundId, sampleResult);
      state = markResultFailed(state, 'Temporary error');

      // Host snapshot arrived and accepted player
      expect(canSubmitResult(state, roundId, true)).toBe(false);
      expect(canRetrySubmission(state, roundId, true)).toBe(false);
    });
  });

  describe('Memory Grid Deterministic Board Generation & Ranking', () => {
    it('produces identical deterministic boards for the same seed across multiple calls', () => {
      const seed = 771234;
      const boardA = generateDeterministicMemoryGridBoard(3, 4, seed);
      const boardB = generateDeterministicMemoryGridBoard(3, 4, seed);

      expect(boardA).toEqual(boardB);
      expect(boardA.length).toBe(12);
    });

    it('produces different board layouts for different seeds', () => {
      const board1 = generateDeterministicMemoryGridBoard(4, 4, 11111);
      const board2 = generateDeterministicMemoryGridBoard(4, 4, 99999);

      expect(board1).not.toEqual(board2);
    });

    it('ensures exactly two tiles exist for every pairId and all pairs are complete', () => {
      const cols = 4;
      const rows = 5;
      const pairCount = Math.floor((cols * rows) / 2); // 10 pairs = 20 tiles
      const board = generateDeterministicMemoryGridBoard(cols, rows, 54321);

      expect(board.length).toBe(20);

      const pairCounts: Record<number, number> = {};
      for (const tile of board) {
        pairCounts[tile.pairId] = (pairCounts[tile.pairId] || 0) + 1;
      }

      expect(Object.keys(pairCounts).length).toBe(pairCount);
      for (let i = 0; i < pairCount; i++) {
        expect(pairCounts[i]).toBe(2);
      }
    });

    it('ranks finished runs by elapsed time, breaking ties by move count', () => {
      const playerIds = ['p1', 'p2', 'p3', 'p4'];
      const playerNames = { p1: 'Alice', p2: 'Bob', p3: 'Charlie', p4: 'Dana' };

      const results: Record<string, PlayerRoundResult> = {
        p1: { playerId: 'p1', displayName: 'Alice', score: 18500, secondaryScore: 12, completedAt: 1000, didFinish: true },
        p2: { playerId: 'p2', displayName: 'Bob', score: 18500, secondaryScore: 10, completedAt: 1000, didFinish: true }, // Same time, fewer moves -> wins tie
        p3: { playerId: 'p3', displayName: 'Charlie', score: 14200, secondaryScore: 14, completedAt: 1000, didFinish: true }, // Fastest time -> 1st place
        p4: { playerId: 'p4', displayName: 'Dana', score: 999999, secondaryScore: 8, completedAt: 1000, didFinish: false }, // DNF -> last
      };

      const ranked = rankMemoryGridResults(results, playerIds, playerNames);

      expect(ranked[0].playerId).toBe('p3'); // 14200ms
      expect(ranked[1].playerId).toBe('p2'); // 18500ms, 10 moves
      expect(ranked[2].playerId).toBe('p1'); // 18500ms, 12 moves
      expect(ranked[3].playerId).toBe('p4'); // DNF
    });

    it('finalizes missing participants with DNF score and secondaryScore 999 for memory_grid', () => {
      const state: CompetitiveRoundState = {
        roundId: 'round_mg_1',
        gameId: 'memory_grid',
        phase: 'playing',
        scheduledStartAt: 5000,
        scheduledEndsAt: 30000,
        seed: 4444,
        participantIds: ['host_user', 'guest_user'],
        participantNames: { host_user: 'Host', guest_user: 'Guest' },
        results: {
          host_user: { playerId: 'host_user', displayName: 'Host', score: 16000, secondaryScore: 12, completedAt: 21000, didFinish: true },
        },
        isFinalized: false,
        version: 1,
      };

      const finalized = finalizeRoundWithDNF(state, 30000);

      expect(finalized.isFinalized).toBe(true);
      expect(finalized.results['guest_user']).toBeDefined();
      expect(finalized.results['guest_user'].didFinish).toBe(false);
      expect(finalized.results['guest_user'].score).toBe(999999);
      expect(finalized.results['guest_user'].secondaryScore).toBe(999);
    });

    it('getAuthoritativeGridDims extracts valid cols and rows from roundState and ignores invalid values', () => {
      const stateWithConfig: CompetitiveRoundState = {
        roundId: 'round_cfg_1',
        gameId: 'memory_grid',
        phase: 'playing',
        scheduledStartAt: 5000,
        scheduledEndsAt: 30000,
        seed: 1234,
        participantIds: ['p1'],
        participantNames: { p1: 'Host' },
        roundConfig: { cols: 5, rows: 6, gridSize: 'large5x6' },
        results: {},
        isFinalized: false,
        version: 1,
      };

      expect(getAuthoritativeGridDims(stateWithConfig, 3, 4)).toEqual({ cols: 5, rows: 6 });

      // Missing or invalid config falls back safely
      expect(getAuthoritativeGridDims(null, 3, 4)).toEqual({ cols: 3, rows: 4 });
      expect(getAuthoritativeGridDims({ ...stateWithConfig, roundConfig: undefined }, 4, 4)).toEqual({ cols: 4, rows: 4 });
    });

    it('generates identical board when two devices with different local setups use authoritative roundConfig', () => {
      const hostRoundState: CompetitiveRoundState = {
        roundId: 'round_sync_1',
        gameId: 'memory_grid',
        phase: 'playing',
        scheduledStartAt: 5000,
        scheduledEndsAt: 30000,
        seed: 888777,
        participantIds: ['host_uid', 'guest_uid'],
        participantNames: { host_uid: 'Host', guest_uid: 'Guest' },
        roundConfig: { cols: 4, rows: 4, gridSize: 'small4x4' },
        results: {},
        isFinalized: false,
        version: 1,
      };

      // Host reads authoritative dims
      const hostDims = getAuthoritativeGridDims(hostRoundState, 3, 4);
      const hostBoard = generateDeterministicMemoryGridBoard(hostDims.cols, hostDims.rows, hostRoundState.seed);

      // Guest had local preference of 6x6, but uses host's authoritative roundConfig
      const guestDims = getAuthoritativeGridDims(hostRoundState, 6, 6);
      const guestBoard = generateDeterministicMemoryGridBoard(guestDims.cols, guestDims.rows, hostRoundState.seed);

      expect(hostDims).toEqual({ cols: 4, rows: 4 });
      expect(guestDims).toEqual({ cols: 4, rows: 4 });
      expect(guestBoard).toEqual(hostBoard);
      expect(guestBoard.length).toBe(16);
    });
  });
});
