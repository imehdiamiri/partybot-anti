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
      setSoundEnabled: (enabled) => set({ isSoundEnabled: enabled }),
      setVibrationEnabled: (enabled) => set({ isVibrationEnabled: enabled }),
      setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),
      setPlayerName: (name) => set({ playerName: name }),
      saveGameConfig: (gameId, config, playerNames) => set((state) => ({
        lastGameConfigs: { ...state.lastGameConfigs, [gameId]: config },
        lastPlayerNames: { ...state.lastPlayerNames, [gameId]: playerNames },
      })),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
