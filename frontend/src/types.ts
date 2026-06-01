export type TabId = "calculator" | "players" | "myGame" | "training";
export type Street = "preflop" | "flop" | "turn" | "river";

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
  recommendation: {
    action: string;
    reason: string;
    raise_sizing?: { sizing: string; amount: number | null; reasoning: string };
  };
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

export interface SessionData {
  id: number;
  user_id: string;
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
  total_rounds: number;
  total_profit: number;
  ai_summary: string | null;
}

export interface RoundData {
  id: number;
  session_id: number;
  round_number: number;
  hole_cards: string[];
  community_cards: string[];
  num_players: number;
  position: string | null;
  streets: unknown[];
  result: string | null;
  profit: number;
  pot_size: number;
  notes: string | null;
  created_at: string | null;
}

export interface OpponentData {
  id: number;
  name: string;
  user_id: string;
  tendency_tags: string[];
  vpip_estimate: number | null;
  pfr_estimate: number | null;
  notes: string;
  key_hands: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface LeakData {
  id: number;
  user_id: string;
  description: string;
  category: string;
  ev_impact: string;
  status: string;
  source: string;
  session_id: number | null;
  evidence: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PIDVersion {
  id: number;
  version: number;
  trigger: string;
  session_id: number | null;
  created_at: string | null;
}

export interface PIDVersionFull extends PIDVersion {
  pid_markdown: string;
}

export interface DrillScenario {
  hole_cards?: string[];
  community_cards?: string[];
  street?: string;
  outs?: number;
  pot_size?: number;
  bet_to_call?: number;
  your_stack?: number;
  bluff_size?: number;
}

export interface PendingDrill {
  drill_id: string;
  scenario: DrillScenario;
  question_text: string;
  answer_type: string;
}

export interface DrillCheckResult {
  is_correct: boolean;
  correct_answer: number;
  explanation: string | null;
  accuracy_now: number;
  graduated: boolean;
}

export interface SkillProgressData {
  skill: string;
  total_attempts: number;
  correct_count: number;
  current_accuracy: number;
  status: string;
  streak_days: number;
  last_attempt_date: string | null;
  best_streak: number;
  avg_response_time_ms: number;
  graduated_at: string | null;
}

export interface DrillAttemptData {
  id: number;
  skill: string;
  is_correct: boolean;
  correct_answer: number;
  user_answer: number;
  response_time_ms: number;
  source: string;
  created_at: string | null;
}

export interface FocusSuggestion {
  suggested_skill: string;
  reason: string;
}

export interface ReviewQuestion {
  question_text: string;
  correct_answer: number;
  answer_type: string;
  tolerance: number;
}

export interface ReviewHand {
  round_number: number;
  hole_cards: string[];
  community_cards: string[];
  pot_size: number;
  bet_to_call: number;
  result: string | null;
  ev_gap: number;
  questions: ReviewQuestion[];
}

export interface SessionReview {
  hands: ReviewHand[];
}

export interface ReviewCheckResult {
  is_correct: boolean;
  correct_answer: number;
  explanation: string | null;
}
