import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PartyCard } from '../models/CardModels';

interface CustomCardsState {
  customCards: PartyCard[];
  addCustomCard: (card: PartyCard) => void;
  removeCustomCard: (id: string) => void;
  clearAll: () => void;
}

export const useCustomCardsStore = create<CustomCardsState>()(
  persist(
    (set, get) => ({
      customCards: [],
      
      addCustomCard: (card) => {
        set({ customCards: [card, ...get().customCards] });
      },
      
      removeCustomCard: (id) => {
        set({ customCards: get().customCards.filter(c => c.id !== id) });
      },
      
      clearAll: () => {
        set({ customCards: [] });
      },
    }),
    {
      name: 'custom-cards-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
