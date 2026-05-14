/**
 * Canonical Player model — single source of truth across the app.
 *
 * Used by:
 *  - useGameStore (single-device sessions)
 *  - MultiplayerService / useMultiplayerStore (online rooms)
 *  - Friends, lobby, team setup, all game session components
 *
 * Field semantics:
 *  - id          stable per-session identifier (uid for online, generated locally for offline)
 *  - displayName the visible name shown in UI
 *  - avatar      optional avatar URL or asset key
 *  - isHost      true for the room creator (online) or first player (offline)
 *  - isLocal     true on the device that owns this player input
 *  - isReady     online lobby readiness flag (undefined offline)
 */
export interface Player {
  id: string;
  displayName: string;
  avatar?: string;
  isHost: boolean;
  isLocal: boolean;
  isReady?: boolean;
}

/** Build a local (single-device) player from a typed-in name. */
export function makeLocalPlayer(displayName: string, index: number): Player {
  return {
    id: `local_${index}`,
    displayName,
    isHost: index === 0,
    isLocal: true,
  };
}
