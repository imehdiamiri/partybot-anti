import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerStore } from '../store/useMultiplayerStore';
import { gameSyncService } from '../services/GameSyncService';
import { GameMode } from '../models/AppModels';

/**
 * useGameSync — synchronize mini-game state across devices.
 *
 * Single-device  → everything runs locally; sendAction routes straight to the
 *                  reducer-style handler.
 * Multi-device   → host is authoritative. Host computes next state and calls
 *                  `syncState(next)` which broadcasts a versioned snapshot.
 *                  Clients receive snapshots through `useMultiplayerStore` and
 *                  apply them blindly. When clients interact they `sendAction`
 *                  to enqueue a unique-keyed entry under `/rooms/<code>/actions`;
 *                  the host drains, processes once (de-dup by action key), and
 *                  acks via `ackAction` so the queue stays small.
 *
 * Reconnect: when a client mounts in multiplayer mode it pulls a snapshot
 * synchronously via `getSnapshot()` so the UI is consistent before the live
 * subscription delivers the next event.
 */
export function useGameSync<T>(
  mode: GameMode,
  localState: T,
  setLocalState: React.Dispatch<React.SetStateAction<T>>,
  onActionReceived?: (type: string, data: any, playerId: string) => void
) {
  const isMultiplayer = mode === GameMode.multiDevice || mode === GameMode.teamMode;
  const {
    gameState,
    broadcastState,
    pushAction,
    playerActions,
    isHost,
    roomCode,
  } = useMultiplayerStore();

  const processedKeys = useRef<Set<string>>(new Set());
  const watermarkLoaded = useRef<string | null>(null);

  // After (re)becoming host, hydrate our processed-action watermark from RTDB
  // so we don't replay any action the previous host already handled.
  useEffect(() => {
    if (!isMultiplayer || !isHost || !roomCode) {
      watermarkLoaded.current = null;
      return;
    }
    if (watermarkLoaded.current === roomCode) return;
    let cancelled = false;
    gameSyncService.loadProcessedActionKeys(roomCode).then((seen) => {
      if (cancelled) return;
      for (const k of seen) processedKeys.current.add(k);
      watermarkLoaded.current = roomCode;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isMultiplayer, isHost, roomCode]);

  // --- HOST: drain client actions exactly once (de-dup by push key) ---
  useEffect(() => {
    if (!isMultiplayer || !isHost || !onActionReceived || !roomCode) return;
    if (watermarkLoaded.current !== roomCode) return; // wait for watermark hydration
    const entries = Object.entries(playerActions || {});
    if (entries.length === 0) return;

    let drained = 0;
    for (const [key, action] of entries) {
      if (processedKeys.current.has(key)) continue;
      processedKeys.current.add(key);
      drained++;
      try {
        onActionReceived(action.type, action.data, action.playerId);
      } catch (e) {
        console.warn('useGameSync: action handler threw', (e as Error)?.message);
      }
      // Persist the watermark BEFORE acking the action so a host crash mid-drain
      // still leaves a trail the next host can resume from.
      gameSyncService.markActionProcessed(roomCode, key).catch(() => {});
      gameSyncService.ackAction(roomCode, key).catch(() => {});
    }
    // Periodically prune the persisted watermark so it stays bounded.
    if (drained > 0 && processedKeys.current.size > 250) {
      gameSyncService.pruneProcessedActions(roomCode, 200).catch(() => {});
    }
  }, [playerActions, isHost, isMultiplayer, onActionReceived, roomCode]);

  // --- CLIENT: apply host-authoritative snapshot ---
  useEffect(() => {
    if (!isMultiplayer || isHost) return;
    if (gameState?.turnData !== undefined) {
      setLocalState(gameState.turnData as T);
    }
  }, [isMultiplayer, isHost, gameState?.turnData, gameState?.version, setLocalState]);

  // --- CLIENT: pull a snapshot once on mount in case we joined late/reconnected ---
  useEffect(() => {
    if (!isMultiplayer || isHost || !roomCode) return;
    let cancelled = false;
    gameSyncService.getSnapshot(roomCode).then((snap) => {
      if (cancelled) return;
      if (snap?.turnData !== undefined) setLocalState(snap.turnData as T);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isMultiplayer, isHost, roomCode, setLocalState]);

  // --- HOST: broadcast finalized state ---
  const syncState = useCallback((newState: T | ((prev: T) => T)) => {
    setLocalState((prev) => {
      const resolved = typeof newState === 'function' ? (newState as any)(prev) : newState;
      if (isMultiplayer && isHost) {
        broadcastState({ turnData: resolved });
      }
      return resolved;
    });
  }, [isMultiplayer, isHost, broadcastState, setLocalState]);

  // --- ANY: send an interaction. On host or single-device runs locally; on
  // client devices it enqueues for the host. ---
  const sendAction = useCallback((type: string, data: any) => {
    if (isMultiplayer && !isHost) {
      pushAction(type, data);
      return;
    }
    if (onActionReceived) {
      onActionReceived(type, data, 'host');
    }
  }, [isMultiplayer, isHost, pushAction, onActionReceived]);

  return {
    syncState,
    sendAction,
    isHost: isMultiplayer ? isHost : true,
    isMultiplayer,
  };
}
