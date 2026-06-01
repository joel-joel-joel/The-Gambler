import { create } from "zustand";
import type { PendingDrill, SkillProgressData, DrillAttemptData, DrillCheckResult } from "../types";

interface TrainingStore {
  currentDrill: PendingDrill | null;
  lastResult: DrillCheckResult | null;
  skillProgress: SkillProgressData[];
  drillHistory: DrillAttemptData[];
  isGenerating: boolean;
  isChecking: boolean;
  speedMode: boolean;
  timerActive: boolean;
  timerRemaining: number;
  mentalMathMode: boolean;
  selectedSkill: string;
  drillSource: string;

  setCurrentDrill: (drill: PendingDrill | null) => void;
  setLastResult: (result: DrillCheckResult | null) => void;
  setSkillProgress: (progress: SkillProgressData[]) => void;
  setDrillHistory: (history: DrillAttemptData[]) => void;
  setIsGenerating: (v: boolean) => void;
  setIsChecking: (v: boolean) => void;
  setSpeedMode: (v: boolean) => void;
  setTimerActive: (v: boolean) => void;
  setTimerRemaining: (v: number) => void;
  setMentalMathMode: (v: boolean) => void;
  setSelectedSkill: (skill: string) => void;
  setDrillSource: (source: string) => void;
  graduatedSkills: () => Set<string>;
}

export const useTrainingStore = create<TrainingStore>((set, get) => ({
  currentDrill: null,
  lastResult: null,
  skillProgress: [],
  drillHistory: [],
  isGenerating: false,
  isChecking: false,
  speedMode: false,
  timerActive: false,
  timerRemaining: 15,
  mentalMathMode: false,
  selectedSkill: "outs",
  drillSource: "random",

  setCurrentDrill: (drill) => set({ currentDrill: drill, lastResult: null }),
  setLastResult: (result) => set({ lastResult: result }),
  setSkillProgress: (progress) => set({ skillProgress: progress }),
  setDrillHistory: (history) => set({ drillHistory: history }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsChecking: (v) => set({ isChecking: v }),
  setSpeedMode: (v) => set({ speedMode: v }),
  setTimerActive: (v) => set({ timerActive: v }),
  setTimerRemaining: (v) => set({ timerRemaining: v }),
  setMentalMathMode: (v) => set({ mentalMathMode: v }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),
  setDrillSource: (source) => set({ drillSource: source }),
  graduatedSkills: () => {
    const progress = get().skillProgress;
    return new Set(progress.filter((p) => p.status === "graduated").map((p) => p.skill));
  },
}));
