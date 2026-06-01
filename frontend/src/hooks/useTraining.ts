import { useState, useCallback } from "react";
import type {
  PendingDrill,
  DrillCheckResult,
  SkillProgressData,
  DrillAttemptData,
  FocusSuggestion,
  SessionReview,
  ReviewCheckResult,
} from "../types";

export function useTraining() {
  const [skillProgress, setSkillProgress] = useState<SkillProgressData[]>([]);
  const [drillHistory, setDrillHistory] = useState<DrillAttemptData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/drills/progress");
      if (!resp.ok) throw new Error("Failed to fetch progress");
      const data = await resp.json();
      setSkillProgress(data);
      return data as SkillProgressData[];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateDrill = useCallback(async (skill: string, source: string = "random"): Promise<PendingDrill> => {
    const resp = await fetch("/api/drills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill, source }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || "Failed to generate drill");
    }
    return resp.json();
  }, []);

  const checkDrill = useCallback(async (
    drillId: string,
    userAnswer: number,
    responseTimeMs: number,
  ): Promise<DrillCheckResult> => {
    const resp = await fetch("/api/drills/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drill_id: drillId,
        user_answer: userAnswer,
        response_time_ms: responseTimeMs,
      }),
    });
    if (!resp.ok) throw new Error("Failed to check drill");
    return resp.json();
  }, []);

  const fetchHistory = useCallback(async (skill?: string, limit: number = 20) => {
    const params = new URLSearchParams();
    if (skill) params.set("skill", skill);
    params.set("limit", String(limit));
    const resp = await fetch(`/api/drills/history?${params}`);
    if (!resp.ok) throw new Error("Failed to fetch history");
    const data = await resp.json();
    setDrillHistory(data);
    return data as DrillAttemptData[];
  }, []);

  const fetchFocus = useCallback(async (): Promise<FocusSuggestion> => {
    const resp = await fetch("/api/drills/focus");
    if (!resp.ok) throw new Error("Failed to fetch focus");
    return resp.json();
  }, []);

  const generateReview = useCallback(async (sessionId: number): Promise<SessionReview> => {
    const resp = await fetch(`/api/sessions/${sessionId}/review`, { method: "POST" });
    if (!resp.ok) throw new Error("Failed to generate review");
    return resp.json();
  }, []);

  const checkReviewAnswer = useCallback(async (
    sessionId: number,
    handIndex: number,
    questionIndex: number,
    correctAnswer: number,
    userAnswer: number,
    answerType: string,
    tolerance: number,
  ): Promise<ReviewCheckResult> => {
    const resp = await fetch(`/api/sessions/${sessionId}/review/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hand_index: handIndex,
        question_index: questionIndex,
        correct_answer: correctAnswer,
        user_answer: userAnswer,
        answer_type: answerType,
        tolerance: tolerance,
      }),
    });
    if (!resp.ok) throw new Error("Failed to check review answer");
    return resp.json();
  }, []);

  return {
    skillProgress,
    drillHistory,
    isLoading,
    fetchProgress,
    generateDrill,
    checkDrill,
    fetchHistory,
    fetchFocus,
    generateReview,
    checkReviewAnswer,
  };
}
