import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameSync } from './useGameSync';
import { useMultiplayerStore } from '../store/useMultiplayerStore';
import { serverClock, getServerNow } from '../services/ServerClock';
import { GameMode } from '../models/AppModels';
import {
  CompetitiveRoundState,
  PlayerRoundResult,
  computeClientPhase,
  CompetitiveRoundPhase,
  reduceCompetitiveRoundAction,
  finalizeRoundWithDNF,
  SubmissionStatus,
  SubmissionMachineState,
  createInitialSubmissionState,
  canSubmitResult,
  startResultSubmission,
  markResultDelivered,
  markResultAccepted,
  markResultFailed,
  canRetrySubmission,
  startResultRetry,
} from '../models/CompetitiveRound';
import { Player } from '../models/Player';

interface UseCompetitiveRoundOptions {
  gameId: string;
  mode: GameMode;
  players: Player[];
  localPlayerId?: string | null;
  roundDurationSeconds?: number; // e.g. 45s
  countdownSeconds?: number; // default 5s
  tileCount?: number; // for Tap in Order preview calculation
  roundConfig?: Record<string, any>; // Host-frozen config (e.g. grid dimensions)
}

export function useCompetitiveRound({
  gameId,
  mode,
  players,
  localPlayerId: propLocalPlayerId,
  roundDurationSeconds = 45,
  countdownSeconds = 5,
  tileCount = 8,
  roundConfig,
}: UseCompetitiveRoundOptions) {
  const isMultiplayer = mode === GameMode.multiDevice;
  const storeLocalPlayerId = useMultiplayerStore(s => s.localPlayerId);
  const storeGameState = useMultiplayerStore(s => s.gameState);
  const resolvedLocalPlayerId = propLocalPlayerId || storeLocalPlayerId || players.find(p => p.isLocal)?.id || players[0]?.id;

  const createInitialRound = useCallback((): CompetitiveRoundState => {
    const now = getServerNow();
    const startAt = now + countdownSeconds * 1000;
    const seed = Math.floor(Math.random() * 1000000) + 1;
    const participantIds = players.map(p => p.id);
    const participantNames = Object.fromEntries(
      players.map(p => [p.id, p.displayName || 'Player'])
    );

    // Deterministic phase offsets
    const goDelayMs = 3000 + (seed % 3000); // 3000ms to 6000ms delay
    const goAtTimestamp = startAt + goDelayMs;

    const previewDurationMs = Math.max(4.0, 3.5 + tileCount * 0.35) * 1000;
    const previewEndTimestamp = startAt + previewDurationMs;

    return {
      roundId: `${gameId}_${now}_${seed}`,
      gameId,
      phase: 'countdown',
      scheduledStartAt: startAt,
      scheduledEndsAt: startAt + roundDurationSeconds * 1000,
      seed,
      goAtTimestamp,
      previewEndTimestamp,
      participantIds,
      participantNames,
      roundConfig,
      results: {},
      isFinalized: false,
      version: 1,
    };
  }, [gameId, countdownSeconds, roundDurationSeconds, tileCount, players, roundConfig]);

  const [roundState, setRoundState] = useState<CompetitiveRoundState>(createInitialRound);
  const [submissionState, setSubmissionState] = useState<SubmissionMachineState>(() =>
    createInitialSubmissionState(roundState.roundId)
  );
  const [countdownRemaining, setCountdownRemaining] = useState<number>(countdownSeconds);

  const activeRoundIdRef = useRef<string>(roundState.roundId);
  const inFlightRef = useRef<string | null>(null);

  // Action reducer for host
  const onActionReceived = useCallback(
    (type: string, data: any, senderPlayerId: string) => {
      if (type === 'SUBMIT_RESULT') {
        setRoundState(prev => reduceCompetitiveRoundAction(prev, type, data, senderPlayerId));
      }
    },
    []
  );

  const { syncState, sendAction, isHost } = useGameSync<CompetitiveRoundState>(
    mode,
    roundState,
    setRoundState,
    onActionReceived
  );

  // Authoritative Startup Barrier: guests wait until host snapshot is received
  const hasAuthoritativeSnapshot = !!(
    storeGameState?.turnData &&
    (storeGameState.turnData as any).gameId === gameId &&
    (storeGameState.turnData as any).roundId
  );
  const isAuthoritativeReady = !isMultiplayer || isHost || hasAuthoritativeSnapshot;

  // Host reconciliation: local player result is accepted if present in roundState.results
  const isAcceptedByHost = !!(resolvedLocalPlayerId && roundState.results?.[resolvedLocalPlayerId]);
  const effectiveStatus: SubmissionStatus = isAcceptedByHost ? 'accepted' : submissionState.status;
  const isLocallyCompleted = effectiveStatus !== 'idle';
  const isLocallySubmitted = effectiveStatus === 'delivered' || effectiveStatus === 'accepted';

  // Detect when roundId changes (e.g. host starts Next Round) and reset local state
  useEffect(() => {
    if (roundState.roundId !== activeRoundIdRef.current) {
      activeRoundIdRef.current = roundState.roundId;
      inFlightRef.current = null;
      setSubmissionState(createInitialSubmissionState(roundState.roundId));
    }
  }, [roundState.roundId]);

  // Host: broadcast authoritative state updates to room
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;
    syncState(roundState);
  }, [roundState, isHost, isMultiplayer, syncState]);

  // Host server-clock readiness: wait briefly for offset sample before first round countdown starts
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;
    let cancelled = false;
    serverClock.waitUntilReady(600).then((ready) => {
      if (cancelled || !ready) return;
      setRoundState((prev) => {
        if (prev.phase !== 'countdown' || prev.isFinalized) return prev;
        const now = getServerNow();
        const startAt = now + countdownSeconds * 1000;
        const goDelayMs = 3000 + (prev.seed % 3000);
        const previewDurationMs = Math.max(4.0, 3.5 + tileCount * 0.35) * 1000;
        return {
          ...prev,
          scheduledStartAt: startAt,
          scheduledEndsAt: startAt + roundDurationSeconds * 1000,
          goAtTimestamp: startAt + goDelayMs,
          previewEndTimestamp: startAt + previewDurationMs,
        };
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isMultiplayer, isHost, countdownSeconds, roundDurationSeconds, tileCount]);

  // Client & Host: live phase and countdown ticker anchored to server clock
  useEffect(() => {
    if (!isMultiplayer || !isAuthoritativeReady) return;

    const interval = setInterval(() => {
      const now = getServerNow();
      const clientCalc = computeClientPhase(roundState, now);

      setCountdownRemaining(clientCalc.countdownSeconds);

      // If host detects deadline passed and round not finalized, finalize with DNF
      if (isHost && clientCalc.hasExpired && !roundState.isFinalized) {
        setRoundState(prev => finalizeRoundWithDNF(prev, now));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isMultiplayer, isHost, roundState, isAuthoritativeReady]);

  // Submit result handler with synchronous ref guard, payload preservation, and error recovery
  const submitResult = useCallback(
    async (result: Omit<PlayerRoundResult, 'playerId' | 'displayName'>): Promise<void> => {
      // Synchronous double-send prevention per roundId
      if (!canSubmitResult(submissionState, roundState.roundId, isAcceptedByHost)) {
        return;
      }
      if (inFlightRef.current === roundState.roundId) {
        return;
      }
      inFlightRef.current = roundState.roundId;

      const pid = resolvedLocalPlayerId || 'local_player';
      const playerObj = players.find(p => p.id === pid);
      const fullResult: PlayerRoundResult = {
        ...result,
        completedAt: result.completedAt || getServerNow(),
        playerId: pid,
        displayName: playerObj?.displayName || 'Player',
      };

      setSubmissionState(prev => startResultSubmission(prev, roundState.roundId, fullResult));

      if (!isMultiplayer) {
        setSubmissionState(prev => markResultAccepted(prev));
        return;
      }

      try {
        if (isHost) {
          setRoundState(prev =>
            reduceCompetitiveRoundAction(
              prev,
              'SUBMIT_RESULT',
              { roundId: roundState.roundId, result: fullResult },
              pid
            )
          );
          setSubmissionState(prev => markResultAccepted(prev));
        } else {
          await sendAction('SUBMIT_RESULT', {
            roundId: roundState.roundId,
            result: fullResult,
          });
          setSubmissionState(prev => markResultDelivered(prev));
        }
      } catch (err: any) {
        // Unlock on delivery rejection so the player can retry
        inFlightRef.current = null;
        setSubmissionState(prev =>
          markResultFailed(prev, err?.message || 'Failed to submit result. Tap to retry.')
        );
        console.warn('useCompetitiveRound submitResult failed, retry unlocked:', err);
      }
    },
    [submissionState, roundState.roundId, isAcceptedByHost, resolvedLocalPlayerId, players, isMultiplayer, isHost, sendAction]
  );

  // Retry submission handler: resends the exact stored payload without re-computation
  const retrySubmission = useCallback(async (): Promise<void> => {
    if (!canRetrySubmission(submissionState, roundState.roundId, isAcceptedByHost)) {
      return;
    }
    if (inFlightRef.current === roundState.roundId) {
      return;
    }
    inFlightRef.current = roundState.roundId;

    const { nextState, payloadToResend } = startResultRetry(submissionState, roundState.roundId);
    if (!payloadToResend) {
      inFlightRef.current = null;
      return;
    }

    setSubmissionState(nextState);

    const pid = resolvedLocalPlayerId || 'local_player';
    try {
      if (isHost) {
        setRoundState(prev =>
          reduceCompetitiveRoundAction(
            prev,
            'SUBMIT_RESULT',
            { roundId: roundState.roundId, result: payloadToResend },
            pid
          )
        );
        setSubmissionState(prev => markResultAccepted(prev));
      } else {
        await sendAction('SUBMIT_RESULT', {
          roundId: roundState.roundId,
          result: payloadToResend,
        });
        setSubmissionState(prev => markResultDelivered(prev));
      }
    } catch (err: any) {
      inFlightRef.current = null;
      setSubmissionState(prev =>
        markResultFailed(prev, err?.message || 'Failed to submit result. Tap to retry.')
      );
      console.warn('useCompetitiveRound retrySubmission failed, retry unlocked:', err);
    }
  }, [submissionState, roundState.roundId, isAcceptedByHost, resolvedLocalPlayerId, isMultiplayer, isHost, sendAction]);

  // Play again handler (Host triggers new synchronized round)
  const playAgain = useCallback(() => {
    if (!isHost) return;
    const nextRound = createInitialRound();
    activeRoundIdRef.current = nextRound.roundId;
    inFlightRef.current = null;
    setSubmissionState(createInitialSubmissionState(nextRound.roundId));
    setRoundState(nextRound);
  }, [isHost, createInitialRound]);

  // Derived phase
  const now = getServerNow();
  const currentCalc = computeClientPhase(roundState, now);
  const effectivePhase: CompetitiveRoundPhase = !isAuthoritativeReady
    ? 'waiting'
    : isMultiplayer
    ? currentCalc.phase
    : 'playing';

  const completedCount = Object.keys(roundState.results || {}).length;
  const totalParticipants = roundState.participantIds?.length || players.length;

  return {
    roundState,
    phase: effectivePhase,
    countdownRemaining,
    seed: roundState.seed,
    goAtTimestamp: roundState.goAtTimestamp,
    previewEndTimestamp: roundState.previewEndTimestamp,
    roundConfig: roundState.roundConfig,
    results: roundState.results || {},
    isFinalized: roundState.isFinalized,
    isHost,
    isMultiplayer,
    isAuthoritativeReady,
    localSubmitted: isLocallySubmitted,
    isLocallyCompleted,
    isSubmitting: effectiveStatus === 'sending',
    submissionStatus: effectiveStatus,
    submissionError: submissionState.error,
    pendingResult: submissionState.pendingResult,
    localPlayerId: resolvedLocalPlayerId,
    completedCount,
    totalPlayers: totalParticipants,
    submitResult,
    retrySubmission,
    playAgain,
  };
}
