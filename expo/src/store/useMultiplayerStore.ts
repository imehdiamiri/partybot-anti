import { create } from 'zustand';
import { multiplayerService, MultiplayerRoom } from '../services/MultiplayerService';
import { gameSyncService, GameStatePayload, PlayerAction } from '../services/GameSyncService';
import { serverClock } from '../services/ServerClock';
import { auth, rtdb } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { showToast } from '../components/ToastOverlay';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface MultiplayerState {
  currentRoom: MultiplayerRoom | null;
  roomCode: string | null;
  isHost: boolean;
  localPlayerId: string | null;
  error: string | null;
  isBusy: boolean;
  connectionState: ConnectionState;

  // Real-time synced game state
  gameState: GameStatePayload | null;
  playerActions: Record<string, PlayerAction>;
  presence: Record<string, { online: boolean; lastSeen: number }>;

  // Actions
  createRoom: (gameId: string, hostName: string) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  clearError: () => void;

  // Game sync methods
  initGameSync: (initialState: GameStatePayload) => Promise<void>;
  broadcastState: (partialState: Partial<GameStatePayload>) => Promise<void>;
  pushAction: (type: string, data: any) => Promise<void>;
  clearActions: () => Promise<void>;
  subscribeToGameState: () => void;
  unsubscribeAll: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => {
  let unsubscribe: (() => void) | null = null;
  let gameStateUnsub: (() => void) | null = null;
  let actionsUnsub: (() => void) | null = null;
  let presenceUnsub: (() => void) | null = null;
  let connectedUnsub: (() => void) | null = null;
  let subscribedRoomCode: string | null = null;
  // Track the previous hostId so we can detect (and announce) host migration.
  let previousHostId: string | null = null;

  function startConnectionWatcher(): void {
    if (connectedUnsub) return;
    try {
      const r = ref(rtdb, '.info/connected');
      connectedUnsub = onValue(r, (snap) => {
        const connected = snap.val() === true;
        const next: ConnectionState = connected ? 'connected' : 'reconnecting';
        const prev = get().connectionState;
        if (next === prev) return;
        set({ connectionState: next });
        if (next === 'reconnecting') {
          showToast.warning('Reconnecting to room…');
        } else if (prev === 'reconnecting') {
          showToast.success('Back online');
        }
      });
    } catch {
      // Offline / testing fallback
    }
  }

  function stopConnectionWatcher(): void {
    if (connectedUnsub) { connectedUnsub(); connectedUnsub = null; }
    set({ connectionState: 'connected' });
  }

  /**
   * Apply a fresh room snapshot: reflect host changes, announce host migrations
   * once per transition, and try to claim host if we're the lowest-joinedAt
   * peer with no live host.
   */
  function applyRoomSnapshot(room: MultiplayerRoom): void {
    const myId = get().localPlayerId;
    const newHostId = room.hostId;
    if (previousHostId && newHostId && previousHostId !== newHostId) {
      const newHost = room.players?.[newHostId];
      const label = myId && newHostId === myId ? 'You are now the host' : `${newHost?.displayName ?? 'A player'} is the new host`;
      showToast.info(label);
    }
    previousHostId = newHostId ?? previousHostId;

    set({
      currentRoom: room,
      isHost: newHostId === myId,
    });

    // Try to promote ourselves only when the previous host has fully dropped.
    if (!myId) return;
    const players = room.players || {};
    const hostStillPresent = !!(newHostId && players[newHostId]);
    if (hostStillPresent) return;
    if (!players[myId]) return;
    const candidates = Object.values(players).sort(
      (a: any, b: any) => (a.joinedAt || 0) - (b.joinedAt || 0)
    );
    if (candidates[0]?.id !== myId) return;
    multiplayerService.claimHost(room.roomCode).then((claimed) => {
      if (!claimed) return;
      // Fire-and-forget observability ping. Failure is non-fatal.
      import('@/src/lib/firebase').then(({ functions }) => {
        import('firebase/functions').then(({ httpsCallable }) => {
          httpsCallable(functions, 'recordHostMigration')({
            roomCode: room.roomCode,
            reason: 'host_gone',
          }).catch(() => {});
        });
      });
    }).catch(() => {});
  }

  return {
    currentRoom: null,
    roomCode: null,
    isHost: false,
    localPlayerId: null,
    error: null,
    isBusy: false,
    connectionState: 'connected',
    gameState: null,
    playerActions: {},
    presence: {},

    createRoom: async (gameId: string, hostName: string) => {
      set({ isBusy: true, error: null });
      try {
        const { roomCode, hostId } = await multiplayerService.createRoom(gameId, hostName);
        previousHostId = hostId;

        set({
          roomCode,
          isHost: true,
          localPlayerId: hostId,
          isBusy: false,
        });
        startConnectionWatcher();
        serverClock.start();

        unsubscribe = multiplayerService.listenToRoom(roomCode, (room) => {
          if (!room || room.status === 'closed') {
            if (get().currentRoom || get().roomCode) {
              if (unsubscribe) { unsubscribe(); unsubscribe = null; }
              stopConnectionWatcher();
              serverClock.stop();
              get().unsubscribeAll();
              const code = get().roomCode;
              const pid = get().localPlayerId;
              if (code && pid) {
                gameSyncService.stopHeartbeat(code, pid);
              }
              set({
                currentRoom: null,
                roomCode: null,
                localPlayerId: null,
                isHost: false,
                gameState: null,
                playerActions: {},
                presence: {},
                error: 'Room was closed',
              });
            }
            return;
          }
          applyRoomSnapshot(room);
        });

        await gameSyncService.setPresence(roomCode, hostId);
        get().subscribeToGameState();
        return roomCode;
      } catch (err: any) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        stopConnectionWatcher();
        serverClock.stop();
        get().unsubscribeAll();
        set({
          currentRoom: null,
          roomCode: null,
          localPlayerId: null,
          isHost: false,
          gameState: null,
          playerActions: {},
          presence: {},
          error: err.message,
          isBusy: false,
        });
        throw err;
      }
    },

    joinRoom: async (code: string, playerName: string) => {
      set({ isBusy: true, error: null });
      try {
        const { hostId, playerId } = await multiplayerService.joinRoom(code, playerName);
        previousHostId = hostId;

        set({
          roomCode: code,
          isHost: false,
          localPlayerId: playerId,
          isBusy: false,
        });
        startConnectionWatcher();
        serverClock.start();

        unsubscribe = multiplayerService.listenToRoom(code, (room) => {
          if (!room || room.status === 'closed') {
            if (get().currentRoom || get().roomCode) {
              if (unsubscribe) { unsubscribe(); unsubscribe = null; }
              stopConnectionWatcher();
              serverClock.stop();
              get().unsubscribeAll();
              const rCode = get().roomCode;
              const pid = get().localPlayerId;
              if (rCode && pid) {
                gameSyncService.stopHeartbeat(rCode, pid);
              }
              set({
                currentRoom: null,
                roomCode: null,
                localPlayerId: null,
                isHost: false,
                gameState: null,
                playerActions: {},
                presence: {},
                error: 'Room was closed',
              });
            }
            return;
          }
          applyRoomSnapshot(room);
        });

        await gameSyncService.setPresence(code, playerId);
        get().subscribeToGameState();
      } catch (err: any) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        stopConnectionWatcher();
        serverClock.stop();
        get().unsubscribeAll();
        set({
          currentRoom: null,
          roomCode: null,
          localPlayerId: null,
          isHost: false,
          gameState: null,
          playerActions: {},
          presence: {},
          error: err.message,
          isBusy: false,
        });
        throw err;
      }
    },

    leaveRoom: async () => {
      const { roomCode, localPlayerId, isHost } = get();
      if (!roomCode || !localPlayerId) return;

      try {
        gameSyncService.stopHeartbeat(roomCode, localPlayerId);
        if (isHost) {
          // Host explicitly closes — flag the room closed so peers exit cleanly.
          // The Cloud Function sweeper GCs the actual node based on TTL.
          await multiplayerService.closeRoom(roomCode);
          await gameSyncService.cleanupGameState(roomCode).catch(() => {});
        } else {
          await multiplayerService.leaveRoom(roomCode, localPlayerId);
        }
      } catch (e) {
        console.warn('Multiplayer: leaveRoom error', (e as Error)?.message);
      } finally {
        get().unsubscribeAll();
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        stopConnectionWatcher();
        serverClock.stop();
        previousHostId = null;
        set({
          currentRoom: null,
          roomCode: null,
          localPlayerId: null,
          isHost: false,
          gameState: null,
          playerActions: {},
          presence: {},
        });
      }
    },

    startGame: async () => {
      const { roomCode, isHost } = get();
      if (roomCode && isHost) {
        await multiplayerService.startGame(roomCode);
      }
    },

    clearError: () => set({ error: null }),

    // ═══ Game Sync Methods ═══

    initGameSync: async (initialState: GameStatePayload) => {
      const { roomCode, isHost } = get();
      if (!roomCode || !isHost) return;
      await gameSyncService.initGameState(roomCode, initialState);
    },

    broadcastState: async (partialState: Partial<GameStatePayload>) => {
      const { roomCode, isHost } = get();
      if (!roomCode || !isHost) return;
      await gameSyncService.broadcastState(roomCode, partialState);
    },

    pushAction: async (type: string, data: any): Promise<void> => {
      const { roomCode, localPlayerId } = get();
      if (!roomCode || !localPlayerId) return;
      await gameSyncService.pushAction(roomCode, {
        playerId: localPlayerId,
        type,
        data,
      });
    },

    clearActions: async () => {
      const { roomCode, isHost } = get();
      if (!roomCode || !isHost) return;
      await gameSyncService.clearActions(roomCode);
    },

    subscribeToGameState: () => {
      const { roomCode } = get();
      if (!roomCode) return;

      // If already subscribed to this exact room with active listeners, it's a strict no-op
      if (subscribedRoomCode === roomCode && gameStateUnsub && actionsUnsub && presenceUnsub) {
        return;
      }

      // If room changed or partial listeners exist, clean up first
      if (subscribedRoomCode && subscribedRoomCode !== roomCode) {
        get().unsubscribeAll();
      } else {
        if (gameStateUnsub) { gameStateUnsub(); gameStateUnsub = null; }
        if (actionsUnsub) { actionsUnsub(); actionsUnsub = null; }
        if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
      }

      subscribedRoomCode = roomCode;

      gameStateUnsub = gameSyncService.listenToGameState(roomCode, (state) => {
        set({ gameState: state });
      });

      actionsUnsub = gameSyncService.listenToActions(roomCode, (actions) => {
        set({ playerActions: actions });
      });

      presenceUnsub = gameSyncService.listenToPresence(roomCode, (presence) => {
        set({ presence });
        // Re-evaluate host migration whenever presence changes.
        const room = get().currentRoom;
        if (room) applyRoomSnapshot(room);
      });
    },

    unsubscribeAll: () => {
      const activeRoom = subscribedRoomCode || get().roomCode;
      if (activeRoom) {
        gameSyncService.removeAllListeners(activeRoom);
      }
      if (gameStateUnsub) { gameStateUnsub(); gameStateUnsub = null; }
      if (actionsUnsub) { actionsUnsub(); actionsUnsub = null; }
      if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
      subscribedRoomCode = null;
    },
  };
});

// Keep the auth import alive for tree-shakers; we use it indirectly via service.
void auth;
