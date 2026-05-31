import { create } from "zustand";
import type { CalculationResult, GameState } from "../types";

interface GameStore extends GameState {
  results: CalculationResult | null;
  isLoading: boolean;
  error: string | null;

  setHoleCards: (cards: string[]) => void;
  setCommunityCards: (cards: string[]) => void;
  setNumPlayers: (n: number) => void;
  setPotSize: (size: number) => void;
  setBetToCall: (bet: number) => void;
  setPosition: (pos: string | null) => void;
  setYourStack: (stack: number | null) => void;
  setVillainStack: (stack: number | null) => void;
  setResults: (results: CalculationResult | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetAll: () => void;
}

const initialState: GameState = {
  holeCards: [],
  communityCards: [],
  numPlayers: 6,
  potSize: 0,
  betToCall: 0,
  position: null,
  yourStack: null,
  villainStack: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  results: null,
  isLoading: false,
  error: null,

  setHoleCards: (cards) => set({ holeCards: cards }),
  setCommunityCards: (cards) => set({ communityCards: cards }),
  setNumPlayers: (n) => set({ numPlayers: n }),
  setPotSize: (size) => set({ potSize: size }),
  setBetToCall: (bet) => set({ betToCall: bet }),
  setPosition: (pos) => set({ position: pos }),
  setYourStack: (stack) => set({ yourStack: stack }),
  setVillainStack: (stack) => set({ villainStack: stack }),
  setResults: (results) => set({ results }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  resetAll: () => set({ ...initialState, results: null, error: null }),
}));
