import { create } from "zustand";
import type { BoardUpdate, CalculationResult, GameState, Street } from "../types";

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

interface GameStore extends GameState {
  street: Street;
  results: CalculationResult | null;
  isLoading: boolean;
  error: string | null;
  undoSnapshot: GameState | null;
  prevResults: CalculationResult | null;
  streetResults: Partial<Record<Street, CalculationResult>>;
  viewingStreet: Street | null;
  roundKey: number;
  tableSize: number;

  setHoleCards: (cards: string[]) => void;
  setTableSize: (n: number) => void;
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
  setStreet: (street: Street) => void;
  setViewingStreet: (street: Street | null) => void;
  nextStreet: () => void;
  foldRound: () => void;
}

const initialState: GameState = {
  holeCards: [],
  communityCards: [],
  numPlayers: 2,
  potSize: 0,
  betToCall: 0,
  position: null,
  yourStack: null,
  villainStack: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  street: "preflop" as Street,
  results: null,
  isLoading: false,
  error: null,
  undoSnapshot: null,
  prevResults: null,
  streetResults: {},
  viewingStreet: null,
  roundKey: 0,
  tableSize: 0,

  setHoleCards: (cards) => set({ holeCards: cards }),
  setCommunityCards: (cards) => set({ communityCards: cards }),
  setNumPlayers: (n) => set({ numPlayers: n }),
  setTableSize: (n) => set({ tableSize: n, numPlayers: n }),
  setPotSize: (size) => set({ potSize: size }),
  setBetToCall: (bet) => set({ betToCall: bet }),
  setPosition: (pos) => set({ position: pos }),
  setYourStack: (stack) => set({ yourStack: stack }),
  setVillainStack: (stack) => set({ villainStack: stack }),
  setResults: (results) => set({ results }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  resetAll: () => set({
    ...initialState,
    street: "preflop" as Street,
    results: null,
    error: null,
    undoSnapshot: null,
    prevResults: null,
  }),

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

  setStreet: (street) => set({ street, viewingStreet: null }),

  setViewingStreet: (street) => set({ viewingStreet: street }),

  nextStreet: () => {
    const { street, results, streetResults } = get();
    const idx = STREET_ORDER.indexOf(street);
    if (idx >= STREET_ORDER.length - 1) return;
    const updated = { ...streetResults };
    if (results) updated[street] = results;
    set({
      street: STREET_ORDER[idx + 1],
      betToCall: 0,
      prevResults: results,
      streetResults: updated,
      viewingStreet: null,
    });
  },

  foldRound: () => {
    set((state) => ({
      ...initialState,
      numPlayers: state.tableSize || initialState.numPlayers,
      street: "preflop" as Street,
      results: null,
      error: null,
      undoSnapshot: null,
      prevResults: null,
      streetResults: {},
      viewingStreet: null,
      roundKey: state.roundKey + 1,
      tableSize: state.tableSize,
    }));
  },
}));
