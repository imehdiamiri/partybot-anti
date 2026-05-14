import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedIdea {
  id: string;
  title: string;
  description: string;
  steps: string[];
  tags: string[];
  savedAt: number;
}

interface SavedIdeasState {
  savedIdeas: SavedIdea[];
  saveIdea: (idea: SavedIdea) => void;
  removeIdea: (id: string) => void;
  isIdeaSaved: (id: string) => boolean;
  clearAll: () => void;
}

export const useSavedIdeasStore = create<SavedIdeasState>()(
  persist(
    (set, get) => ({
      savedIdeas: [],

      saveIdea: (idea) => {
        const current = get().savedIdeas;
        if (current.some(i => i.id === idea.id)) return; // Already saved
        set({ savedIdeas: [{ ...idea, savedAt: Date.now() }, ...current] });
      },

      removeIdea: (id) => {
        set({ savedIdeas: get().savedIdeas.filter(i => i.id !== id) });
      },

      isIdeaSaved: (id) => {
        return get().savedIdeas.some(i => i.id === id);
      },

      clearAll: () => {
        set({ savedIdeas: [] });
      },
    }),
    {
      name: 'saved-ideas-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
