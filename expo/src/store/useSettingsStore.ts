import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  isSoundEnabled: boolean;
  isVibrationEnabled: boolean;
  hasCompletedOnboarding: boolean;
  playerName: string;
  lastGameConfigs: Record<string, Record<string, any>>;
  lastPlayerNames: Record<string, string[]>;
  /** Last player count used across ALL games — shared default for the setup screen. */
  lastGlobalPlayerCount: number;
  /** Last player name list used across ALL games — shared default for the setup screen. */
  lastGlobalPlayerNames: string[];
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setPlayerName: (name: string) => void;
  saveGameConfig: (gameId: string, config: Record<string, any>, playerNames: string[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isSoundEnabled: true,
      isVibrationEnabled: true,
      hasCompletedOnboarding: false,
      playerName: '',
      lastGameConfigs: {},
      lastPlayerNames: {},
      lastGlobalPlayerCount: 2,
      lastGlobalPlayerNames: [],
      setSoundEnabled: (enabled) => set({ isSoundEnabled: enabled }),
      setVibrationEnabled: (enabled) => set({ isVibrationEnabled: enabled }),
      setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),
      setPlayerName: (name) => set({ playerName: name }),
      saveGameConfig: (gameId, config, playerNames) => set((state) => ({
        lastGameConfigs: { ...state.lastGameConfigs, [gameId]: config },
        lastPlayerNames: { ...state.lastPlayerNames, [gameId]: playerNames },
        lastGlobalPlayerCount: playerNames.length,
        lastGlobalPlayerNames: playerNames,
      })),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
