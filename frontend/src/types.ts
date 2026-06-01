export interface Card {
  rank: string;
  suit: string;
  code: string;
}

export interface GameState {
  holeCards: string[];
  communityCards: string[];
  numPlayers: number;
  potSize: number;
  betToCall: number;
  position: string | null;
  yourStack: number | null;
  villainStack: number | null;
}

export interface OutsData {
  draws: { draw_type: string; outs: number }[];
  total_outs: number;
  outs_cards: string[];
}

export interface EffectiveStack {
  effective_stack: number;
  effective_stack_bb: number;
  stack_depth: string;
}

export interface CalculationResult {
  equity: number;
  ev: number;
  pot_odds: number;
  pot_odds_ratio: string;
  equity_required: number;
  outs: OutsData;
  rule_of_2_4: number;
  hand_rank: string | null;
  spr: number | null;
  mdf: number | null;
  bet_pot_percentage: number | null;
  effective_stack: EffectiveStack | null;
  preflop_hand_tier: number | null;
  recommendation: { action: string; reason: string };
  street: string;
}

export interface QuickEntryResult {
  hole_cards: string[] | null;
  pot_size: number | null;
  bet_to_call: number | null;
  position: string | null;
  num_players: number | null;
  confidence: number;
  assumptions: string[];
}

export interface BoardUpdate {
  pot_size?: number;
  bet_to_call?: number;
  community_cards?: string[];
  hole_cards?: string[];
  num_players?: number;
  position?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  boardUpdate: BoardUpdate | null;
  timestamp: number;
}
