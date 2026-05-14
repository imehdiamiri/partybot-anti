import { create } from 'zustand';
import { multiplayerService, MultiplayerRoom } from '../services/MultiplayerService';
import { gameSyncService, GameStatePayload, PlayerAction } from '../services/GameSyncService';
import { auth, rtdb } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { showToast } from '../components/ToastOverlay';

/**
 * useMultiplayerStore — single source of truth for the active room session.
 *
 * Identity: `localPlayerId` is ALWAYS `auth.currentUser.uid`. RTDB rules
 * require this for player/presence/action writes. Anonymous users get a
 * persistent uid via Firebase anonymous sign-in (handled in _layout.tsx),
 * so even guest play works without random ids.
 *
 * Host migration: when the current host's player row disappears (left or
 * presence timed out) the store calls `multiplayerService.claimHost`. The
 * lowest joinedAt remaining player wins. Failure is silent (another peer
 * already won the race). Transitions emit toasts ("Reconnecting…",
 * "<player> is the new host") so users get clear UX feedback.
 *
 * Connection state: `.info/connected` is observed while the user is in a
 * room. `connectionState === 'reconnecting'` flips when RTDB drops, which
 * the `<MultiplayerStatusBanner/>` surfaces to the player.
 */

export type ConnectionState = 'connected' | 'reconnecting';

interface MultiplayerState {
  currentRoom: MultiplayerRoom | null;
  roomCode: string | null;
  isHost: boolean;
  localPlayerId: string | null;
  error: string | null;
  isBusy: boolean;
  connectionState: ConnectionState;

  // Game sync state
  gameState: GameStatePayload | null;
  playerActions: Record<string, PlayerAction>;
  presence: Record<string, { online: boolean; lastSeen: number }>;

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
  // Track the previous hostId so we can detect (and announce) host migration.
  let previousHostId: string | null = null;

  function startConnectionWatcher(): void {
    if (connectedUnsub) return;
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

        unsubscribe = multiplayerService.listenToRoom(roomCode, (room) => {
          if (!room || room.status === 'closed') {
            if (get().currentRoom) {
              set({ currentRoom: null, roomCode: null, error: 'Room was closed' });
              if (unsubscribe) unsubscribe();
              stopConnectionWatcher();
            }
            return;
          }
          applyRoomSnapshot(room);
        });

        await gameSyncService.setPresence(roomCode, hostId);
        return roomCode;
      } catch (err: any) {
        set({ error: err.message, isBusy: false });
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

        unsubscribe = multiplayerService.listenToRoom(code, (room) => {
          if (!room || room.status === 'closed') {
            if (get().currentRoom) {
              set({ currentRoom: null, roomCode: null, error: 'Room was closed' });
              if (unsubscribe) unsubscribe();
              stopConnectionWatcher();
            }
            return;
          }
          applyRoomSnapshot(room);
        });

        await gameSyncService.setPresence(code, playerId);
      } catch (err: any) {
        set({ error: err.message, isBusy: false });
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
        if (unsubscribe) unsubscribe();
        stopConnectionWatcher();
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

    pushAction: async (type: string, data: any) => {
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
      const { roomCode } = get();
      if (roomCode) gameSyncService.removeAllListeners(roomCode);
      if (gameStateUnsub) { gameStateUnsub(); gameStateUnsub = null; }
      if (actionsUnsub) { actionsUnsub(); actionsUnsub = null; }
      if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
    },
  };
});

// Keep the auth import alive for tree-shakers; we use it indirectly via service.
void auth;
