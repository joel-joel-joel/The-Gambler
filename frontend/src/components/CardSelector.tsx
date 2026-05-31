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
          <span>
            Hole: {holeCards.length}/2{" "}
            {holeCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
          <span>
            Board: {communityCards.length}/5{" "}
            {communityCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="text-sm px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
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
                  ${isHole ? "bg-blue-600 border-blue-400" : ""}
                  ${isCommunity ? "bg-green-700 border-green-400" : ""}
                  ${!isSelected ? "bg-gray-800 border-gray-600 hover:bg-gray-700" : ""}
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
