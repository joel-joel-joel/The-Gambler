import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import { SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";
import type { RoundData } from "../types";

export function RoundHistory() {
  const { rounds, activeSession } = useSessionStore();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!activeSession || rounds.length === 0) return null;

  return (
    <div className="border border-surface-raised rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm text-stone-400 hover:text-stone-200 transition-colors duration-200 cursor-pointer"
      >
        <span className="font-medium">
          Round History <span className="font-mono text-gold">({rounds.length})</span>
        </span>
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          &#9660;
        </span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {rounds.map((round) => (
            <RoundItem
              key={round.id}
              round={round}
              isExpanded={expandedId === round.id}
              onToggle={() =>
                setExpandedId(expandedId === round.id ? null : round.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundItem({
  round,
  isExpanded,
  onToggle,
}: {
  round: RoundData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const profitColor =
    round.profit > 0
      ? "text-emerald-400"
      : round.profit < 0
        ? "text-red-400"
        : "text-stone-400";

  function formatCard(card: string) {
    return card[0] + (SUIT_SYMBOLS[card[1]] || card[1]);
  }

  return (
    <div className="bg-surface rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 text-xs cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-stone-500 font-mono">#{round.round_number}</span>
          <span className="text-stone-200">
            {round.hole_cards.map(formatCard).join(" ")}
          </span>
          {round.result && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                round.result === "won"
                  ? "bg-emerald-900 text-emerald-300"
                  : round.result === "lost"
                    ? "bg-red-900 text-red-300"
                    : "bg-surface-raised text-stone-400"
              }`}
            >
              {round.result}
            </span>
          )}
        </div>
        <span className={`font-mono ${profitColor}`}>
          {round.profit >= 0 ? "+" : ""}${round.profit.toFixed(0)}
        </span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 text-[10px] text-stone-400 space-y-1">
          {round.community_cards.length > 0 && (
            <div>
              Board:{" "}
              {round.community_cards.map((c, i) => (
                <span key={i} className={SUIT_COLORS[c[1]]}>
                  {formatCard(c)}{" "}
                </span>
              ))}
            </div>
          )}
          <div>
            Pot: <span className="font-mono">${round.pot_size}</span>
            {round.position && <> · Position: {round.position}</>}
            {" · "}Players: {round.num_players}
          </div>
          {round.notes && <div className="text-stone-500">{round.notes}</div>}
        </div>
      )}
    </div>
  );
}
