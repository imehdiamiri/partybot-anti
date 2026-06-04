import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedCardsState {
  savedCardIds: string[];
  toggleCard: (id: string) => void;
  isCardSaved: (id: string) => boolean;
  clearAll: () => void;
}

export const useSavedCardsStore = create<SavedCardsState>()(
  persist(
    (set, get) => ({
      savedCardIds: [],
      
      toggleCard: (id) => {
        const current = get().savedCardIds;
        if (current.includes(id)) {
          set({ savedCardIds: current.filter(x => x !== id) });
        } else {
          set({ savedCardIds: [...current, id] });
        }
      },
      
      isCardSaved: (id) => {
        return get().savedCardIds.includes(id);
      },
      
      clearAll: () => {
        set({ savedCardIds: [] });
      },
    }),
    {
      name: 'saved-cards-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
