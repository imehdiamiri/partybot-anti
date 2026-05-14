import { rtdb as database, auth } from '../lib/firebase';
import { ref, set, get, onValue, update, remove, onDisconnect, serverTimestamp } from 'firebase/database';
import { Player } from '../models/Player';

/**
 * MultiplayerService — RTDB-backed room lifecycle.
 *
 * Hardened lifecycle:
 *  - Player ids are ALWAYS the Firebase auth.uid. RTDB rules require
 *    `auth.uid == $pid` for player/presence/action writes.
 *  - We DO NOT call `onDisconnect(roomRef).remove()` anymore. Destroying the
 *    whole room when the host briefly drops is the #1 source of broken party
 *    sessions. Instead we attach an `onDisconnect` to the host's player row
 *    only, and expire stale rooms server-side via TTL + a Cloud Function
 *    sweeper that runs against `rooms` (`createdAt` + `lastActivityAt`).
 *  - `lastActivityAt` is bumped on join/leave/start so a sweeper can safely
 *    GC silent rooms older than ~30 minutes without killing a paused game.
 *  - Host migration: if the original host's player row disappears (left or
 *    timed out via presence), the lowest `joinedAt` remaining player promotes
 *    itself to host by writing `hostId`. RTDB rules permit any player to
 *    become host iff the previous hostId no longer exists in `players`.
 */

export type MultiplayerPlayer = Player & { joinedAt?: number };

export interface MultiplayerRoom {
  roomCode: string;
  gameId: string;
  hostId: string;
  players: Record<string, MultiplayerPlayer>;
  status: 'waiting' | 'playing' | 'closed';
  createdAt: number;
  lastActivityAt?: number;
}

const ROOM_CODE_LEN = 6;

class MultiplayerService {
  private generateRoomCode(): string {
    const min = Math.pow(10, ROOM_CODE_LEN - 1);
    const max = Math.pow(10, ROOM_CODE_LEN) - min;
    return Math.floor(min + Math.random() * max).toString();
  }

  private requireUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required to use multiplayer.');
    return uid;
  }

  async createRoom(gameId: string, hostName: string): Promise<{ roomCode: string; hostId: string }> {
    const hostId = this.requireUid();
    const roomCode = this.generateRoomCode();
    const roomRef = ref(database, `rooms/${roomCode}`);
    const now = Date.now();

    const initialPlayer: MultiplayerPlayer = {
      id: hostId,
      displayName: hostName,
      isHost: true,
      isLocal: true,
      isReady: true,
      joinedAt: now,
    };

    await set(roomRef, {
      roomCode,
      gameId,
      hostId,
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: { [hostId]: initialPlayer },
    });

    // IMPORTANT: only remove the host's player row on disconnect, NOT the
    // whole room. The remaining players can promote a new host or wait for
    // the original host to reconnect within the TTL window.
    const hostPlayerRef = ref(database, `rooms/${roomCode}/players/${hostId}`);
    await onDisconnect(hostPlayerRef).remove();

    return { roomCode, hostId };
  }

  async joinRoom(roomCode: string, playerName: string): Promise<{ hostId: string; playerId: string }> {
    const playerId = this.requireUid();
    const roomRef = ref(database, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) throw new Error('Room not found');

    const roomData = snapshot.val() as MultiplayerRoom;
    if (roomData.status === 'closed') throw new Error('Room is closed');
    if (roomData.status !== 'waiting') throw new Error('Game already started');

    const now = Date.now();
    const newPlayer: MultiplayerPlayer = {
      id: playerId,
      displayName: playerName,
      isHost: false,
      isLocal: true,
      isReady: false,
      joinedAt: now,
    };

    await update(ref(database, `rooms/${roomCode}`), {
      [`players/${playerId}`]: newPlayer,
      lastActivityAt: now,
    });

    const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
    await onDisconnect(playerRef).remove();

    return { hostId: roomData.hostId, playerId };
  }

  listenToRoom(roomCode: string, callback: (room: MultiplayerRoom | null) => void): () => void {
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.val() as MultiplayerRoom) : null);
    });
    return unsubscribe;
  }

  async leaveRoom(roomCode: string, playerId: string): Promise<void> {
    const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
    try { await onDisconnect(playerRef).cancel(); } catch {}
    await remove(playerRef);
    // Best-effort activity bump so sweeper resets TTL on the room.
    try {
      await update(ref(database, `rooms/${roomCode}`), { lastActivityAt: Date.now() });
    } catch {}
  }

  async startGame(roomCode: string): Promise<void> {
    const roomRef = ref(database, `rooms/${roomCode}`);
    await update(roomRef, { status: 'playing', lastActivityAt: Date.now() });
  }

  /**
   * Host-only: hard-close the room (e.g. user explicitly chose "Close Room").
   * Cancels the host's onDisconnect first so the cleanup is deterministic.
   */
  async closeRoom(roomCode: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try { await onDisconnect(ref(database, `rooms/${roomCode}/players/${uid}`)).cancel(); } catch {}
    }
    await update(ref(database, `rooms/${roomCode}`), { status: 'closed', lastActivityAt: Date.now() });
    // Defer the actual node delete to the Cloud Function sweeper; flagging it
    // 'closed' is enough for clients to hand themselves out gracefully.
  }

  /**
   * Host migration — call from a guest when the previous host has been gone
   * past the staleness window. Writes itself as the new hostId. RTDB rules
   * permit this only if the previous hostId is no longer in `players`.
   */
  async claimHost(roomCode: string): Promise<boolean> {
    const uid = this.requireUid();
    const snap = await get(ref(database, `rooms/${roomCode}`));
    if (!snap.exists()) return false;
    const room = snap.val() as MultiplayerRoom;
    const players = room.players || {};
    if (room.hostId && players[room.hostId]) return false;
    if (!players[uid]) return false;

    // Lowest joinedAt wins to avoid races.
    const candidates = Object.values(players).sort(
      (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)
    );
    if (candidates[0]?.id !== uid) return false;

    await update(ref(database, `rooms/${roomCode}`), {
      hostId: uid,
      lastActivityAt: Date.now(),
      [`players/${uid}/isHost`]: true,
    });
    return true;
  }
}

export const multiplayerService = new MultiplayerService();

// Re-export sentinels for callers that need them.
export { serverTimestamp };
