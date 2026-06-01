import { useGameStore } from "../store/gameStore";
import { RANKS, SUITS, SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";

export function CardSelector() {
  const { holeCards, communityCards, setHoleCards, setCommunityCards } = useGameStore();

  const selectedCards = new Set([...holeCards, ...communityCards]);

  function handleCardClick(card: string) {
    if (selectedCards.has(card)) {
      if (holeCards.includes(card)) {
        setHoleCards(holeCards.filter((c) => c !== card));
      } else {
        setCommunityCards(communityCards.filter((c) => c !== card));
      }
      return;
    }

    if (holeCards.length < 2) {
      setHoleCards([...holeCards, card]);
    } else if (communityCards.length < 5) {
      setCommunityCards([...communityCards, card]);
    }
  }

  function handleClear() {
    setHoleCards([]);
    setCommunityCards([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-stone-400">
            Hole: <span className="text-gold font-mono">{holeCards.length}/2</span>{" "}
            {holeCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
          <span className="text-stone-400">
            Board: <span className="text-emerald-400 font-mono">{communityCards.length}/5</span>{" "}
            {communityCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="text-sm px-3 py-1 bg-surface-raised rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-13 gap-1">
        {RANKS.map((rank) =>
          SUITS.map((suit) => {
            const card = rank + suit;
            const isSelected = selectedCards.has(card);
            const isHole = holeCards.includes(card);
            const isCommunity = communityCards.includes(card);

            return (
              <button
                key={card}
                onClick={() => handleCardClick(card)}
                className={`
                  w-8 h-10 text-xs font-bold rounded border flex flex-col items-center justify-center
                  transition-all duration-200 cursor-pointer
                  ${isHole ? "bg-gold-700 border-gold-500 shadow-glow-sm" : ""}
                  ${isCommunity ? "bg-emerald-900 border-emerald-600" : ""}
                  ${!isSelected ? "bg-surface border-surface-raised hover:bg-surface-raised" : ""}
                  ${SUIT_COLORS[suit]}
                `}
              >
                <span>{rank}</span>
                <span className="text-[10px]">{SUIT_SYMBOLS[suit]}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
