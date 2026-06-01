import { create } from "zustand";
import type { SessionData, RoundData } from "../types";

interface SessionStore {
  activeSession: SessionData | null;
  rounds: RoundData[];
  isLoading: boolean;

  setActiveSession: (session: SessionData | null) => void;
  setRounds: (rounds: RoundData[]) => void;
  addRound: (round: RoundData) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  rounds: [],
  isLoading: false,

  setActiveSession: (session) => set({ activeSession: session }),
  setRounds: (rounds) => set({ rounds }),
  addRound: (round) =>
    set((state) => ({ rounds: [...state.rounds, round] })),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
