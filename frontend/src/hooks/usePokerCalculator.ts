import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import type { CalculationResult } from "../types";

export function usePokerCalculator() {
  const {
    holeCards,
    communityCards,
    numPlayers,
    tableSize,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
    setResults,
    setIsLoading,
    setError,
  } = useGameStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (holeCards.length < 2) {
      setResults(null);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hole_cards: holeCards,
            community_cards: communityCards,
            num_players: numPlayers,
            table_size: tableSize,
            pot_size: potSize,
            bet_to_call: betToCall,
            position,
            your_stack: yourStack,
            villain_stack: villainStack,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: CalculationResult = await response.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Calculation failed");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    holeCards,
    communityCards,
    numPlayers,
    tableSize,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
  ]);
}
