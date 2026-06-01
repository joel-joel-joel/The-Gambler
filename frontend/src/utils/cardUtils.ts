export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export const SUIT_SYMBOLS: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_COLORS: Record<string, string> = {
  s: "text-stone-200",
  h: "text-red-400",
  d: "text-sky-400",
  c: "text-emerald-400",
};

export function allCards(): string[] {
  const cards: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push(rank + suit);
    }
  }
  return cards;
}

export function formatCard(code: string): { rank: string; suit: string; symbol: string; color: string } {
  const rank = code[0];
  const suit = code[1];
  return {
    rank,
    suit,
    symbol: SUIT_SYMBOLS[suit],
    color: SUIT_COLORS[suit],
  };
}
