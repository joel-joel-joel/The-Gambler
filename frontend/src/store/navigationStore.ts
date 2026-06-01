import { create } from "zustand";
import type { TabId } from "../types";

interface NavigationStore {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeTab: "calculator",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
