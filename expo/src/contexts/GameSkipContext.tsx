import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface GameSkipContextValue {
  /** Register a skip handler (call with null to unregister) */
  registerSkip: (handler: (() => void) | null, playerName?: string) => void;
  /** Current skip handler (null if no skip available) */
  skipHandler: (() => void) | null;
  /** Current player name for confirmation dialog */
  skipPlayerName: string | undefined;
}

const GameSkipContext = createContext<GameSkipContextValue>({
  registerSkip: () => {},
  skipHandler: null,
  skipPlayerName: undefined,
});

export function GameSkipProvider({ children }: { children: React.ReactNode }) {
  const [skipHandler, setSkipHandler] = useState<(() => void) | null>(null);
  const [skipPlayerName, setSkipPlayerName] = useState<string | undefined>(undefined);

  const registerSkip = useCallback((handler: (() => void) | null, playerName?: string) => {
    // Wrap in function to avoid React calling it as an updater
    setSkipHandler(() => handler);
    setSkipPlayerName(playerName);
  }, []);

  return (
    <GameSkipContext.Provider value={{ registerSkip, skipHandler, skipPlayerName }}>
      {children}
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
  const { skipHandler, skipPlayerName } = useContext(GameSkipContext);
  return { skipHandler, skipPlayerName };
}
