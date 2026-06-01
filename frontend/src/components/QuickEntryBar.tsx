import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { QuickEntryResult } from "../types";
import { HelpTooltip } from "./HelpTooltip";

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
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Quick entry: "AKs 150 40 btn 6p"'
          className="flex-1 bg-surface border border-surface-raised rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gold transition-colors duration-200"
          autoFocus
        />
        <HelpTooltip title="Quick Entry Format">
          <p className="mb-1.5">Type your hand info in shorthand:</p>
          <ul className="space-y-1 text-stone-300">
            <li><span className="text-stone-100 font-mono">AKs</span> — hole cards (s=suited, o=offsuit)</li>
            <li><span className="text-stone-100 font-mono">150</span> — pot size</li>
            <li><span className="text-stone-100 font-mono">40</span> — bet to call</li>
            <li><span className="text-stone-100 font-mono">btn</span> — position (utg/mp/co/btn/sb/bb)</li>
            <li><span className="text-stone-100 font-mono">6p</span> — number of players</li>
          </ul>
          <p className="mt-1.5 text-stone-500">Order doesn't matter. All fields optional except cards.</p>
        </HelpTooltip>
        <button
          type="submit"
          className="px-4 py-2 bg-gold text-stone-900 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
        >
          Go
        </button>
      </form>
      {toast && (
        <div className="absolute top-full mt-2 left-0 bg-gold-900 text-gold-100 text-xs px-3 py-1.5 rounded border border-gold-700">
          {toast}
        </div>
      )}
    </div>
  );
}
