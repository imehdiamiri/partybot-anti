import { rtdb as database } from '../lib/firebase';
import { ref, set, get, onValue, update, remove, push, onDisconnect } from 'firebase/database';

/**
 * GameSyncService — Real-time game state synchronization for multi-device play.
 *
 * Hardened multiplayer infrastructure:
 *   - Monotonic `version` on every state broadcast so clients ignore stale snapshots.
 *   - `lastUpdatedAt` server stamp for diagnostics and reconnect ordering.
 *   - Action keys (push IDs) replace timestamp-based de-duplication so the host
 *     never reprocesses the same action twice even after a reconnect.
 *   - Presence heartbeat (5s interval) plus `onDisconnect` cleanup so the host
 *     can detect dropped clients within ~10s.
 *   - `getSnapshot()` lets reconnecting clients pull the authoritative state in
 *     a single round-trip before subscribing to live updates.
 *
 * Data structure under /rooms/{roomCode}/:
 *   gameState/
 *     version: number              — incremented on every host broadcast
 *     phase: string                — current game phase
 *     currentPlayerIdx: number     — whose turn it is
 *     round: number                — current round
 *     scores: Record<pid, number>  — live scores
 *     turnData: any                — game-specific snapshot (host-authoritative)
 *     lastUpdatedAt: number        — wall-clock ms (host)
 *   actions/                       — per-action push entries; host drains them
 *     {actionKey}: { playerId, type, data, ts }
 *   presence/
 *     {pid}: { online: boolean, lastSeen: number }
 */

export interface GameStatePayload {
  phase: string;
  currentPlayerIdx: number;
  round: number;
  scores: Record<string, number>;
  turnData?: any;
  version?: number;
  lastUpdatedAt?: number;
}

export interface PlayerAction {
  playerId: string;
  type: string;
  data: any;
  ts: number;
}

const HEARTBEAT_MS = 5000;
const STALE_AFTER_MS = 12000;

class GameSyncService {
  private listeners: Map<string, () => void> = new Map();
  private heartbeats: Map<string, ReturnType<typeof setInterval>> = new Map();
  private versions: Map<string, number> = new Map();

  /**
   * Persist the host's processed-action watermark so a freshly-promoted host
   * cannot replay actions that the previous host already handled. This is the
   * server-side counterpart to `useGameSync`'s in-memory `processedKeys` set;
   * after host migration the new host calls `loadProcessedActionKeys()` to
   * seed its set from RTDB before it starts draining the queue.
   */
  async loadProcessedActionKeys(roomCode: string): Promise<Set<string>> {
    try {
      const snap = await get(ref(database, `rooms/${roomCode}/processedActions`));
      if (!snap.exists()) return new Set();
      return new Set(Object.keys(snap.val() || {}));
    } catch {
      return new Set();
    }
  }

  /** Mark an action key as processed in RTDB (host only). */
  async markActionProcessed(roomCode: string, actionKey: string): Promise<void> {
    try {
      await set(ref(database, `rooms/${roomCode}/processedActions/${actionKey}`), Date.now());
    } catch {}
  }

  /**
   * Bound the processedActions watermark so it cannot grow forever. Called
   * opportunistically by the host whenever a draining batch crosses the
   * cap. Drops the oldest entries past `maxKeep`.
   */
  async pruneProcessedActions(roomCode: string, maxKeep: number = 200): Promise<void> {
    try {
      const snap = await get(ref(database, `rooms/${roomCode}/processedActions`));
      if (!snap.exists()) return;
      const entries = Object.entries<number>(snap.val() || {});
      if (entries.length <= maxKeep) return;
      entries.sort((a, b) => (a[1] || 0) - (b[1] || 0));
      const drop = entries.slice(0, entries.length - maxKeep);
      const updates: Record<string, null> = {};
      for (const [k] of drop) updates[k] = null;
      await update(ref(database, `rooms/${roomCode}/processedActions`), updates);
    } catch {}
  }

  /** Initialize game state for a room (host only) */
  async initGameState(roomCode: string, initialState: GameStatePayload): Promise<void> {
    const stateRef = ref(database, `rooms/${roomCode}/gameState`);
    const version = 1;
    this.versions.set(roomCode, version);
    await set(stateRef, {
      ...initialState,
      version,
      lastUpdatedAt: Date.now(),
    });
  }

  /** Broadcast a partial state update (host only). Bumps the monotonic version. */
  async broadcastState(roomCode: string, partialState: Partial<GameStatePayload>): Promise<void> {
    const stateRef = ref(database, `rooms/${roomCode}/gameState`);
    const next = (this.versions.get(roomCode) ?? 0) + 1;
    this.versions.set(roomCode, next);
    await update(stateRef, {
      ...partialState,
      version: next,
      lastUpdatedAt: Date.now(),
    });
  }

  /** Push a player action — uses RTDB push() so each action has a unique key. */
  async pushAction(roomCode: string, action: Omit<PlayerAction, 'ts'>): Promise<void> {
    const actionsRef = ref(database, `rooms/${roomCode}/actions`);
    const newRef = push(actionsRef);
    await set(newRef, { ...action, ts: Date.now() });
  }

  /** Pull a one-shot snapshot for reconnect. Returns null if absent. */
  async getSnapshot(roomCode: string): Promise<GameStatePayload | null> {
    const snap = await get(ref(database, `rooms/${roomCode}/gameState`));
    if (!snap.exists()) return null;
    const v = snap.val() as GameStatePayload;
    if (typeof v.version === 'number') {
      // Track local version watermark so a host doesn't accidentally regress.
      const cur = this.versions.get(roomCode) ?? 0;
      if (v.version > cur) this.versions.set(roomCode, v.version);
    }
    return v;
  }

  /** Listen to game state changes (all players). Filters out stale versions. */
  listenToGameState(
    roomCode: string,
    callback: (state: GameStatePayload | null) => void
  ): () => void {
    const stateRef = ref(database, `rooms/${roomCode}/gameState`);
    let lastSeenVersion = 0;
    const unsubscribe = onValue(stateRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const v = snapshot.val() as GameStatePayload;
      const ver = typeof v.version === 'number' ? v.version : 0;
      if (ver < lastSeenVersion) return; // ignore stale snapshot
      lastSeenVersion = ver;
      callback(v);
    });
    this.listeners.set(`state_${roomCode}`, unsubscribe);
    return unsubscribe;
  }

  /** Listen to player actions (host collects). Each action keyed by push id. */
  listenToActions(
    roomCode: string,
    callback: (actions: Record<string, PlayerAction>) => void
  ): () => void {
    const actionsRef = ref(database, `rooms/${roomCode}/actions`);
    const unsubscribe = onValue(actionsRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
    this.listeners.set(`actions_${roomCode}`, unsubscribe);
    return unsubscribe;
  }

  /** Remove a single action after the host processed it. */
  async ackAction(roomCode: string, actionKey: string): Promise<void> {
    await remove(ref(database, `rooms/${roomCode}/actions/${actionKey}`));
  }

  /** Clear all queued actions (e.g. between rounds). */
  async clearActions(roomCode: string): Promise<void> {
    await remove(ref(database, `rooms/${roomCode}/actions`));
  }

  /**
   * Set player presence + start a heartbeat. The heartbeat refreshes
   * `lastSeen` every 5s so peers can detect dropouts within ~12s.
   */
  async setPresence(roomCode: string, playerId: string): Promise<void> {
    const presenceRef = ref(database, `rooms/${roomCode}/presence/${playerId}`);
    await set(presenceRef, { online: true, lastSeen: Date.now() });
    onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() });

    const key = `${roomCode}_${playerId}`;
    const existing = this.heartbeats.get(key);
    if (existing) clearInterval(existing);
    const id = setInterval(() => {
      update(presenceRef, { online: true, lastSeen: Date.now() }).catch(() => {});
    }, HEARTBEAT_MS);
    this.heartbeats.set(key, id);
  }

  /** Stop the heartbeat for a single player (used on leave). */
  stopHeartbeat(roomCode: string, playerId: string): void {
    const key = `${roomCode}_${playerId}`;
    const id = this.heartbeats.get(key);
    if (id) {
      clearInterval(id);
      this.heartbeats.delete(key);
    }
  }

  /** Listen to player presence */
  listenToPresence(
    roomCode: string,
    callback: (presence: Record<string, { online: boolean; lastSeen: number }>) => void
  ): () => void {
    const presenceRef = ref(database, `rooms/${roomCode}/presence`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
    this.listeners.set(`presence_${roomCode}`, unsubscribe);
    return unsubscribe;
  }

  /** Helper: returns the set of player ids that are considered "live" right now. */
  static stalenessFilter(
    presence: Record<string, { online: boolean; lastSeen: number }> | null | undefined,
    now: number = Date.now()
  ): Set<string> {
    const live = new Set<string>();
    if (!presence) return live;
    for (const [pid, p] of Object.entries(presence)) {
      if (p?.online && now - (p.lastSeen || 0) < STALE_AFTER_MS) live.add(pid);
    }
    return live;
  }

  /** Clean up all room-scoped server state (host only). */
  async cleanupGameState(roomCode: string): Promise<void> {
    this.versions.delete(roomCode);
    await Promise.all([
      remove(ref(database, `rooms/${roomCode}/gameState`)),
      remove(ref(database, `rooms/${roomCode}/actions`)),
      remove(ref(database, `rooms/${roomCode}/presence`)),
      // Watermark is meaningless once the game ends — prevents unbounded growth.
      remove(ref(database, `rooms/${roomCode}/processedActions`)),
    ]);
  }

  /** Remove all listeners + heartbeats for a room. */
  removeAllListeners(roomCode: string): void {
    for (const [key, unsub] of this.listeners) {
      if (key.includes(roomCode)) {
        try { unsub(); } catch {}
        this.listeners.delete(key);
      }
    }
    for (const [key, id] of this.heartbeats) {
      if (key.startsWith(`${roomCode}_`)) {
        clearInterval(id);
        this.heartbeats.delete(key);
      }
    }
  }
}

export const gameSyncService = new GameSyncService();
