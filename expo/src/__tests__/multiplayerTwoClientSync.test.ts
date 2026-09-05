import { useMultiplayerStore } from '../store/useMultiplayerStore';
import { multiplayerService } from '../services/MultiplayerService';
import { gameSyncService, GameStatePayload, PlayerAction } from '../services/GameSyncService';
import { serverClock } from '../services/ServerClock';
import {
  CompetitiveRoundState,
  reduceCompetitiveRoundAction,
  finalizeRoundWithDNF,
  computeClientPhase,
  rankReactionTimeResults,
} from '../models/CompetitiveRound';

// Mock dependencies for useMultiplayerStore
jest.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'mock_uid' } },
  rtdb: {},
}));

jest.mock('../components/ToastOverlay', () => ({
  showToast: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Multiplayer Transport & Store Lifecycle Integration', () => {
  const ROOM_CODE = 'TEST99';
  const HOST_ID = 'host_user_111';
  const GUEST_ID = 'guest_user_222';

  let gameStateListeners: Array<(state: GameStatePayload | null) => void> = [];
  let actionListeners: Array<(actions: Record<string, PlayerAction>) => void> = [];
  let presenceListeners: Array<(presence: Record<string, { online: boolean; lastSeen: number }>) => void> = [];
  let roomListeners: Array<(room: any) => void> = [];

  let stateListenCount = 0;
  let actionsListenCount = 0;
  let presenceListenCount = 0;
  let removeAllListenersCount = 0;
  let stopHeartbeatCount = 0;
  let closeRoomCount = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    gameStateListeners = [];
    actionListeners = [];
    presenceListeners = [];
    roomListeners = [];
    stateListenCount = 0;
    actionsListenCount = 0;
    presenceListenCount = 0;
    removeAllListenersCount = 0;
    stopHeartbeatCount = 0;
    closeRoomCount = 0;

    // Mock MultiplayerService
    jest.spyOn(multiplayerService, 'createRoom').mockResolvedValue({
      roomCode: ROOM_CODE,
      hostId: HOST_ID,
    });

    jest.spyOn(multiplayerService, 'joinRoom').mockResolvedValue({
      hostId: HOST_ID,
      playerId: GUEST_ID,
    });

    jest.spyOn(multiplayerService, 'listenToRoom').mockImplementation((code, cb) => {
      roomListeners.push(cb);
      return () => {
        const idx = roomListeners.indexOf(cb);
        if (idx !== -1) roomListeners.splice(idx, 1);
      };
    });

    jest.spyOn(multiplayerService, 'closeRoom').mockImplementation(async () => {
      closeRoomCount++;
    });

    jest.spyOn(multiplayerService, 'leaveRoom').mockImplementation(async () => {});

    // Mock GameSyncService
    jest.spyOn(gameSyncService, 'setPresence').mockResolvedValue();
    jest.spyOn(gameSyncService, 'stopHeartbeat').mockImplementation(() => {
      stopHeartbeatCount++;
    });
    jest.spyOn(gameSyncService, 'cleanupGameState').mockResolvedValue();

    jest.spyOn(gameSyncService, 'listenToGameState').mockImplementation((code, cb) => {
      stateListenCount++;
      gameStateListeners.push(cb);
      return () => {
        const idx = gameStateListeners.indexOf(cb);
        if (idx !== -1) gameStateListeners.splice(idx, 1);
      };
    });

    jest.spyOn(gameSyncService, 'listenToActions').mockImplementation((code, cb) => {
      actionsListenCount++;
      actionListeners.push(cb);
      return () => {
        const idx = actionListeners.indexOf(cb);
        if (idx !== -1) actionListeners.splice(idx, 1);
      };
    });

    jest.spyOn(gameSyncService, 'listenToPresence').mockImplementation((code, cb) => {
      presenceListenCount++;
      presenceListeners.push(cb);
      return () => {
        const idx = presenceListeners.indexOf(cb);
        if (idx !== -1) presenceListeners.splice(idx, 1);
      };
    });

    jest.spyOn(gameSyncService, 'removeAllListeners').mockImplementation(() => {
      removeAllListenersCount++;
      gameStateListeners = [];
      actionListeners = [];
      presenceListeners = [];
    });

    jest.spyOn(gameSyncService, 'broadcastState').mockImplementation(async (code, partial) => {
      const payload: GameStatePayload = {
        version: 1,
        phase: 'playing',
        currentPlayerIdx: 0,
        round: 1,
        scores: {},
        turnData: partial.turnData,
      };
      gameStateListeners.forEach(cb => cb(payload));
    });

    jest.spyOn(gameSyncService, 'pushAction').mockImplementation(async (code, action) => {
      const fullAction: PlayerAction = {
        ts: Date.now(),
        ...action,
      };
      const actionsObj: Record<string, PlayerAction> = {
        [`act_${Date.now()}`]: fullAction,
      };
      actionListeners.forEach(cb => cb(actionsObj));
    });

    // Reset store state
    useMultiplayerStore.setState({
      currentRoom: null,
      roomCode: null,
      localPlayerId: null,
      isHost: false,
      gameState: null,
      playerActions: {},
      presence: {},
      error: null,
      isBusy: false,
    });
  });

  afterEach(() => {
    useMultiplayerStore.getState().unsubscribeAll();
    serverClock.stop();
  });

  describe('1. Store Subscription Lifecycle & Idempotency', () => {
    it('subscribes to game-state, actions, and presence on createRoom', async () => {
      const code = await useMultiplayerStore.getState().createRoom('reaction_time', 'Host User');

      expect(code).toBe(ROOM_CODE);
      expect(useMultiplayerStore.getState().isHost).toBe(true);
      expect(useMultiplayerStore.getState().localPlayerId).toBe(HOST_ID);
      expect(stateListenCount).toBe(1);
      expect(actionsListenCount).toBe(1);
      expect(presenceListenCount).toBe(1);
    });

    it('calling subscribeToGameState repeatedly for the same room is an idempotent no-op', async () => {
      await useMultiplayerStore.getState().createRoom('reaction_time', 'Host User');

      expect(stateListenCount).toBe(1);

      // Repeated calls
      useMultiplayerStore.getState().subscribeToGameState();
      useMultiplayerStore.getState().subscribeToGameState();

      // Counts remain 1 (no duplicate listeners created or destroyed)
      expect(stateListenCount).toBe(1);
      expect(actionsListenCount).toBe(1);
      expect(presenceListenCount).toBe(1);
    });

    it('cleans up all listeners, stops heartbeat, and resets state on leaveRoom', async () => {
      await useMultiplayerStore.getState().createRoom('reaction_time', 'Host User');
      expect(useMultiplayerStore.getState().roomCode).toBe(ROOM_CODE);

      await useMultiplayerStore.getState().leaveRoom();

      expect(closeRoomCount).toBe(1);
      expect(stopHeartbeatCount).toBe(1);
      expect(removeAllListenersCount).toBe(1);
      expect(useMultiplayerStore.getState().roomCode).toBeNull();
      expect(useMultiplayerStore.getState().currentRoom).toBeNull();
    });

    it('cleans up listeners and sets error when remote room closes', async () => {
      await useMultiplayerStore.getState().joinRoom(ROOM_CODE, 'Guest User');

      expect(useMultiplayerStore.getState().roomCode).toBe(ROOM_CODE);
      expect(roomListeners.length).toBeGreaterThan(0);

      // Trigger remote room close event
      roomListeners[0]({ status: 'closed', roomCode: ROOM_CODE });

      expect(useMultiplayerStore.getState().roomCode).toBeNull();
      expect(useMultiplayerStore.getState().error).toBe('Room was closed');
      expect(removeAllListenersCount).toBe(1);
    });
  });

  describe('2. Two-Client Transport & Action Delivery Integration', () => {
    it('pushes guest action, delivers to host callback, and broadcasts back updated state', async () => {
      // 1. Host creates room
      await useMultiplayerStore.getState().createRoom('reaction_time', 'Host User');
      const roundState: CompetitiveRoundState = {
        roundId: 'round_live_1',
        gameId: 'reaction_time',
        phase: 'playing',
        scheduledStartAt: 10000,
        scheduledEndsAt: 40000,
        seed: 1234,
        goAtTimestamp: 13500,
        participantIds: [HOST_ID, GUEST_ID],
        participantNames: { [HOST_ID]: 'Host User', [GUEST_ID]: 'Guest User' },
        results: {},
        isFinalized: false,
        version: 1,
      };

      // Broadcast initial round
      await useMultiplayerStore.getState().broadcastState({ turnData: roundState });
      expect(useMultiplayerStore.getState().gameState?.turnData).toEqual(roundState);

      // 2. Guest pushes result
      let receivedGuestAction: PlayerAction | null = null;
      jest.spyOn(gameSyncService, 'pushAction').mockImplementationOnce(async (code, action) => {
        const fullAction: PlayerAction = { ts: Date.now(), ...action };
        receivedGuestAction = fullAction;
        // Deliver to store
        actionListeners.forEach(cb => cb({ act_guest_1: fullAction }));
      });

      // Switch context to guest and push action
      useMultiplayerStore.setState({ roomCode: ROOM_CODE, localPlayerId: GUEST_ID, isHost: false });
      await useMultiplayerStore.getState().pushAction('SUBMIT_RESULT', {
        roundId: 'round_live_1',
        result: { score: 240, completedAt: 13740, didFinish: true },
      });

      expect(receivedGuestAction).not.toBeNull();
      expect(receivedGuestAction!.playerId).toBe(GUEST_ID);
      expect(receivedGuestAction!.type).toBe('SUBMIT_RESULT');

      // 3. Host receives guest action and reduces state
      const hostNextState = reduceCompetitiveRoundAction(
        roundState,
        'SUBMIT_RESULT',
        receivedGuestAction!.data,
        receivedGuestAction!.playerId
      );

      expect(hostNextState.results[GUEST_ID]).toBeDefined();
      expect(hostNextState.results[GUEST_ID].score).toBe(240);
      expect(hostNextState.results[GUEST_ID].displayName).toBe('Guest User');

      // 4. Host broadcasts updated state to room
      useMultiplayerStore.setState({ roomCode: ROOM_CODE, localPlayerId: HOST_ID, isHost: true });
      await useMultiplayerStore.getState().broadcastState({ turnData: hostNextState });

      expect((useMultiplayerStore.getState().gameState?.turnData as any).results[GUEST_ID].score).toBe(240);
    });

    it('propagates transport rejection when pushAction rejects so hooks can unlock retry and set error status', async () => {
      useMultiplayerStore.setState({ roomCode: ROOM_CODE, localPlayerId: GUEST_ID, isHost: false });

      jest.spyOn(gameSyncService, 'pushAction').mockRejectedValueOnce(new Error('Network disconnected'));

      await expect(
        useMultiplayerStore.getState().pushAction('SUBMIT_RESULT', { roundId: 'round_1' })
      ).rejects.toThrow('Network disconnected');
    });
  });

  describe('3. Server Clock Readiness Mechanism', () => {
    it('waitUntilReady returns true after offset arrives or immediately if already ready', async () => {
      serverClock.stop();
      expect(serverClock.getIsReady()).toBe(false);

      // Start waiting in background
      const waitPromise = serverClock.waitUntilReady(500);

      // Offset sample arrives
      serverClock.setOffset(2000);

      const ready = await waitPromise;
      expect(ready).toBe(true);
      expect(serverClock.getIsReady()).toBe(true);
      expect(serverClock.getOffset()).toBe(2000);

      // Subsequent call resolves immediately
      const immediate = await serverClock.waitUntilReady(100);
      expect(immediate).toBe(true);
    });

    it('waitUntilReady times out gracefully when no offset sample arrives without throwing', async () => {
      serverClock.stop();
      expect(serverClock.getIsReady()).toBe(false);

      const ready = await serverClock.waitUntilReady(50);
      expect(ready).toBe(false);
    });
  });

  describe('4. Authoritative Snapshot Barrier & Memory Grid Single-Owner Transport', () => {
    it('verifies guest authoritative readiness barrier blocks play until host snapshot arrives', () => {
      // Guest state without host turnData
      useMultiplayerStore.setState({
        roomCode: ROOM_CODE,
        localPlayerId: GUEST_ID,
        isHost: false,
        gameState: null,
      });

      const checkReadiness = (gameId: string) => {
        const state = useMultiplayerStore.getState();
        if (state.isHost) return true;
        const turnData = state.gameState?.turnData as any;
        return !!(turnData && turnData.gameId === gameId && turnData.roundId);
      };

      expect(checkReadiness('memory_grid')).toBe(false);

      // Host publishes authoritative round snapshot with frozen roundConfig
      const hostSnapshot: GameStatePayload = {
        phase: 'playing',
        currentPlayerIdx: 0,
        round: 1,
        scores: {},
        turnData: {
          roundId: 'round_mg_authoritative_1',
          gameId: 'memory_grid',
          phase: 'countdown',
          scheduledStartAt: 10000,
          scheduledEndsAt: 40000,
          seed: 55555,
          participantIds: [HOST_ID, GUEST_ID],
          participantNames: { [HOST_ID]: 'Host', [GUEST_ID]: 'Guest' },
          roundConfig: { cols: 4, rows: 4, gridSize: 'small4x4' },
          results: {},
          isFinalized: false,
          version: 1,
        },
        version: 1,
        lastUpdatedAt: 1000,
      };

      useMultiplayerStore.setState({ gameState: hostSnapshot });

      expect(checkReadiness('memory_grid')).toBe(true);
      expect((useMultiplayerStore.getState().gameState?.turnData as any).roundConfig.cols).toBe(4);
    });

    it('processes Memory Grid SUBMIT_RESULT via competitive reducer without action interference', () => {
      const initialRoundState: CompetitiveRoundState = {
        roundId: 'round_mg_authoritative_1',
        gameId: 'memory_grid',
        phase: 'playing',
        scheduledStartAt: 10000,
        scheduledEndsAt: 40000,
        seed: 55555,
        participantIds: [HOST_ID, GUEST_ID],
        participantNames: { [HOST_ID]: 'Host', [GUEST_ID]: 'Guest' },
        roundConfig: { cols: 4, rows: 4, gridSize: 'small4x4' },
        results: {},
        isFinalized: false,
        version: 1,
      };

      // Guest submits completed board result
      const guestResultPayload = {
        roundId: 'round_mg_authoritative_1',
        result: {
          score: 18200,
          secondaryScore: 12,
          completedAt: 28200,
          didFinish: true,
          details: { moves: 12, elapsedSecs: 18.2, pairCount: 8 },
        },
      };

      const updated = reduceCompetitiveRoundAction(
        initialRoundState,
        'SUBMIT_RESULT',
        guestResultPayload,
        GUEST_ID
      );

      expect(updated.results[GUEST_ID]).toBeDefined();
      expect(updated.results[GUEST_ID].score).toBe(18200);
      expect(updated.results[GUEST_ID].secondaryScore).toBe(12);
      expect(updated.results[GUEST_ID].didFinish).toBe(true);
      expect(updated.roundConfig?.cols).toBe(4);
    });
  });
});
