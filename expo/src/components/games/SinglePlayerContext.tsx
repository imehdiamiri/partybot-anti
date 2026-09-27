import { createContext, useContext, useEffect, useRef } from 'react';
export const SinglePlayerContext = createContext(false);
/** Advance only the handoff, never the final results or gameplay countdown. */
export function useSoloHandoff(onReady: () => void, finalTurn = false) {
  const solo = useContext(SinglePlayerContext) && !finalTurn;
  const advanced = useRef(false);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    if (solo && !advanced.current) { advanced.current = true; ready.current(); }
  }, [solo]);
  return solo;
}
