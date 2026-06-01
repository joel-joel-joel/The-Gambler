import { create } from "zustand";
import type { BoardUpdate, CalculationResult, GameState } from "../types";

interface GameStore extends GameState {
  results: CalculationResult | null;
  isLoading: boolean;
  error: string | null;
  undoSnapshot: GameState | null;

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
  applyBoardUpdate: (update: BoardUpdate) => void;
  undo: () => void;
  clearUndo: () => void;
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

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  results: null,
  isLoading: false,
  error: null,
  undoSnapshot: null,

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
  resetAll: () => set({ ...initialState, results: null, error: null, undoSnapshot: null }),

  applyBoardUpdate: (update) => {
    const state = get();
    const snapshot: GameState = {
      holeCards: state.holeCards,
      communityCards: state.communityCards,
      numPlayers: state.numPlayers,
      potSize: state.potSize,
      betToCall: state.betToCall,
      position: state.position,
      yourStack: state.yourStack,
      villainStack: state.villainStack,
    };

    const changes: Partial<GameState> = {};
    if (update.pot_size !== undefined) changes.potSize = update.pot_size;
    if (update.bet_to_call !== undefined) changes.betToCall = update.bet_to_call;
    if (update.community_cards !== undefined) changes.communityCards = update.community_cards;
    if (update.hole_cards !== undefined) changes.holeCards = update.hole_cards;
    if (update.num_players !== undefined) changes.numPlayers = update.num_players;
    if (update.position !== undefined) changes.position = update.position;

    set({ ...changes, undoSnapshot: snapshot });
  },

  undo: () => {
    const { undoSnapshot } = get();
    if (undoSnapshot) {
      set({ ...undoSnapshot, undoSnapshot: null });
    }
  },

  clearUndo: () => set({ undoSnapshot: null }),
}));
