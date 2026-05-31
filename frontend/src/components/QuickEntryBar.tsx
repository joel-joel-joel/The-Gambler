import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { QuickEntryResult } from "../types";

export function QuickEntryBar() {
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { setHoleCards, setPotSize, setBetToCall, setPosition, setNumPlayers } = useGameStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const response = await fetch("/api/parse-quick-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) throw new Error("Parse failed");

      const data: QuickEntryResult = await response.json();

      if (data.hole_cards) setHoleCards(data.hole_cards);
      if (data.pot_size !== null) setPotSize(data.pot_size);
      if (data.bet_to_call !== null) setBetToCall(data.bet_to_call);
      if (data.position) setPosition(data.position);
      if (data.num_players !== null) setNumPlayers(data.num_players);

      if (data.assumptions.length > 0) {
        setToast(data.assumptions[0]);
        setTimeout(() => setToast(null), 4000);
      }

      setInput("");
    } catch {
      setToast("Failed to parse input");
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Quick entry: "AKs 150 40 btn 6p"'
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500"
        >
          Go
        </button>
      </form>
      {toast && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-900 text-yellow-100 text-xs px-3 py-1.5 rounded">
          {toast}
        </div>
      )}
    </div>
  );
}
