import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useGameStore } from "../store/gameStore";
import type { ChatMessage } from "../types";

export function useChat() {
  const wsRef = useRef<WebSocket | null>(null);
  const { addMessage, setConnected, setWaiting } = useChatStore();
  const { applyBoardUpdate } = useGameStore();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        boardUpdate: data.board_update || null,
        timestamp: Date.now(),
      };

      addMessage(assistantMsg);
      setWaiting(false);

      if (data.board_update) {
        applyBoardUpdate(data.board_update);
      }
    };

    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const gameState = useGameStore.getState();

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        boardUpdate: null,
        timestamp: Date.now(),
      };

      addMessage(userMsg);
      setWaiting(true);

      wsRef.current.send(
        JSON.stringify({
          message: text,
          board_state: {
            hole_cards: gameState.holeCards,
            community_cards: gameState.communityCards,
            num_players: gameState.numPlayers,
            pot_size: gameState.potSize,
            bet_to_call: gameState.betToCall,
            position: gameState.position,
            your_stack: gameState.yourStack,
            villain_stack: gameState.villainStack,
          },
          session_rounds: [],
        })
      );
    },
    [addMessage, setWaiting, applyBoardUpdate]
  );

  return { sendMessage };
}
