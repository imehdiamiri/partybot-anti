import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { GameActivityProvider } from '@/src/components/games/GameActivity';

interface GameSkipContextValue {
  registerHandoff: (handler: (() => void) | null, playerName?: string) => void;
  handoff: { handler: () => void; name?: string } | null;
  /** Register a skip handler (call with null to unregister) */
  registerSkip: (handler: (() => void) | null, playerName?: string) => void;
  /** Current skip handler (null if no skip available) */
  skipHandler: (() => void) | null;
  /** Current player name for confirmation dialog */
  skipPlayerName: string | undefined;
}

const GameSkipContext = createContext<GameSkipContextValue>({
  registerHandoff: () => {},
  handoff: null,
  registerSkip: () => {},
  skipHandler: null,
  skipPlayerName: undefined,
});

export function GameSkipProvider({ children }: { children: React.ReactNode }) {
  const [handoff, setHandoff] = useState<{ handler: () => void; name?: string } | null>(null);
  const registerHandoff = useCallback((handler: (() => void) | null, name?: string) => {
    setHandoff(handler ? { handler, name } : null);
  }, []);
  const [skipHandler, setSkipHandler] = useState<(() => void) | null>(null);
  const [skipPlayerName, setSkipPlayerName] = useState<string | undefined>(undefined);

  const registerSkip = useCallback((handler: (() => void) | null, playerName?: string) => {
    // Wrap in function to avoid React calling it as an updater
    setSkipHandler(() => handler);
    setSkipPlayerName(playerName);
  }, []);

  return (
    <GameSkipContext.Provider value={{ registerSkip, skipHandler, skipPlayerName, registerHandoff, handoff }}>
      <GameActivityProvider>{children}</GameActivityProvider>
    </GameSkipContext.Provider>
  );
}

/** Hook for game components to register their skip handler */
export function useRegisterSkip() {
  const { registerSkip } = useContext(GameSkipContext);
  return registerSkip;
}

/** Hook for the session header to read skip state */
export function useSkipState() {
  const { skipHandler, skipPlayerName, handoff } = useContext(GameSkipContext);
  return { skipHandler: handoff?.handler ?? skipHandler, skipPlayerName: handoff?.name ?? skipPlayerName, skipLabel: handoff ? 'Skip this player' : 'Skip' };
}

export function useRegisterHandoffSkip() { return useContext(GameSkipContext).registerHandoff; }
