import { create } from "zustand";
import type { ChatMessage } from "../types";

interface ChatStore {
  messages: ChatMessage[];
  isConnected: boolean;
  isWaiting: boolean;

  addMessage: (msg: ChatMessage) => void;
  setConnected: (connected: boolean) => void;
  setWaiting: (waiting: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isConnected: false,
  isWaiting: false,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  setConnected: (connected) => set({ isConnected: connected }),
  setWaiting: (waiting) => set({ isWaiting: waiting }),
  clearMessages: () => set({ messages: [] }),
}));
