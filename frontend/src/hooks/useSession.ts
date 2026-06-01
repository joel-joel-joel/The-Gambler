import { useCallback } from "react";
import { useSessionStore } from "../store/sessionStore";
import { useGameStore } from "../store/gameStore";
import { useChatStore } from "../store/chatStore";
import type { SessionData, RoundData } from "../types";

export function useSession() {
  const { activeSession, rounds, setActiveSession, setRounds, addRound, setIsLoading } =
    useSessionStore();
  const gameState = useGameStore();
  const { clearMessages } = useChatStore();

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/sessions", { method: "POST" });
      const session: SessionData = await resp.json();
      setActiveSession(session);
      setRounds([]);
      clearMessages();
    } finally {
      setIsLoading(false);
    }
  }, [setActiveSession, setRounds, setIsLoading, clearMessages]);

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/sessions/${activeSession.id}/finalize`, {
        method: "POST",
      });
      const result = await resp.json();
      setActiveSession(null);
      setRounds([]);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, setActiveSession, setRounds, setIsLoading]);

  const saveRound = useCallback(
    async (result: string | null, profit: number) => {
      if (!activeSession) return;
      const resp = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          hole_cards: gameState.holeCards,
          community_cards: gameState.communityCards,
          num_players: gameState.numPlayers,
          position: gameState.position,
          pot_size: gameState.potSize,
          result,
          profit,
        }),
      });
      const round: RoundData = await resp.json();
      addRound(round);
      gameState.resetAll();
    },
    [activeSession, gameState, addRound]
  );

  const fetchRounds = useCallback(async () => {
    if (!activeSession) return;
    const resp = await fetch(`/api/rounds?session_id=${activeSession.id}`);
    const data: RoundData[] = await resp.json();
    setRounds(data);
  }, [activeSession, setRounds]);

  const checkActiveSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions/active");
      if (resp.ok) {
        const session: SessionData = await resp.json();
        setActiveSession(session);
        const roundsResp = await fetch(`/api/rounds?session_id=${session.id}`);
        const roundsData: RoundData[] = await roundsResp.json();
        setRounds(roundsData);
      }
    } catch {
      // No active session
    }
  }, [setActiveSession, setRounds]);

  return {
    activeSession,
    rounds,
    startSession,
    endSession,
    saveRound,
    fetchRounds,
    checkActiveSession,
  };
}
