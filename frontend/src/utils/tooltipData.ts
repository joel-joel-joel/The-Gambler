export interface TooltipContent {
  title: string;
  what: string;
  formula: string;
  example: string;
  mentalMath: string;
}

export const tooltips: Record<string, TooltipContent> = {
  equity: {
    title: "Equity",
    what: "Your probability of winning the hand if it goes to showdown.",
    formula: "Equity = (Simulated Wins + Ties/2) / Total Simulations",
    example: "You hold A♠K♠ on Q♠7♠3♦. Monte Carlo shows you win ~45% of the time.",
    mentalMath: "Use the Rule of 2 & 4: count outs, multiply by 4 on the flop or 2 on the turn.",
  },
  ev: {
    title: "Expected Value (EV)",
    what: "The average amount you'd win or lose if you made this decision thousands of times.",
    formula: "EV = (Equity × Pot After Call) − ((1 − Equity) × Bet to Call)",
    example: "Pot $100, bet $50, equity 40%. EV = (0.40 × $150) − (0.60 × $50) = +$30.",
    mentalMath: "Quick check: are my pot odds better than my equity? If yes, it's +EV.",
  },
  pot_odds: {
    title: "Pot Odds",
    what: "What percentage of the new pot you're paying to call.",
    formula: "Pot Odds = Bet ÷ (Pot + Bet)",
    example: "Call $20 into $100 pot → you pay 20/120 = 16.7%.",
    mentalMath: "Bet ÷ (Pot + Bet). Quick: half-pot bet = 25%, pot bet = 33%.",
  },
  pot_odds_ratio: {
    title: "Pot Odds Ratio",
    what: "For every $1 you risk, how much you stand to win.",
    formula: "Ratio = (Pot + Bet) : Bet",
    example: "Pot $100, bet $20 → ratio is 6:1. You risk $1 to win $6.",
    mentalMath: "Divide pot by bet. $100 pot, $25 bet = 5:1.",
  },
  equity_required: {
    title: "Equity Required",
    what: "Minimum equity needed to break even on a call.",
    formula: "Same as pot odds percentage",
    example: "Pot odds are 25% → you need at least 25% equity to call profitably.",
    mentalMath: "Same number as pot odds %. If your equity > this number, call.",
  },
  outs: {
    title: "Outs",
    what: "Cards remaining in the deck that improve your hand to a likely winner.",
    formula: "Count cards that complete your draw",
    example: "Flush draw = 9 outs (13 of your suit minus 4 you can see).",
    mentalMath: "Memorize: flush=9, OESD=8, gutshot=4, overcards=6.",
  },
  rule_of_2_4: {
    title: "Rule of 2 & 4",
    what: "Quick way to convert outs into approximate equity without a calculator.",
    formula: "Flop: Outs × 4. Turn: Outs × 2.",
    example: "9 outs (flush draw). Flop: 9 × 4 = 36%. Turn: 9 × 2 = 18%.",
    mentalMath: "This IS the mental math. Flush=36%/18%, OESD=32%/16%, gutshot=16%/8%.",
  },
  spr: {
    title: "Stack-to-Pot Ratio (SPR)",
    what: "How deep your effective stack is relative to the pot.",
    formula: "SPR = Effective Stack ÷ Pot Size",
    example: "You have $200 behind, pot is $50. SPR = 4. Top pair is strong enough to stack off.",
    mentalMath: "SPR < 3 = go with top pair. SPR > 13 = need very strong hands or big draws.",
  },
  mdf: {
    title: "Minimum Defense Frequency (MDF)",
    what: "How often you must call to prevent villain from profiting by bluffing with any two cards.",
    formula: "MDF = 1 − (Bet ÷ (Pot + Bet))",
    example: "Villain bets $100 into $100 pot. MDF = 50%. Call at least 50% of your range.",
    mentalMath: "Pot-size bet = defend 50%. Half-pot bet = defend 67%.",
  },
  bluff_break_even: {
    title: "Bluff Break-Even %",
    what: "How often your bluff needs to make the opponent fold to be profitable.",
    formula: "Break-Even = Bluff Size ÷ (Pot + Bluff Size)",
    example: "Bluff $75 into $100. Break-even = 75/175 = 43%.",
    mentalMath: "Half-pot bluff needs to work 33%. Pot-size bluff needs to work 50%.",
  },
  recommendation: {
    title: "Recommendation",
    what: "Suggested action based on your equity vs equity required, EV, and stack depth.",
    formula: "If EV > 0 and equity > required → CALL/RAISE. Otherwise → FOLD.",
    example: "Equity 40%, required 25%, EV +$30 → CALL (or RAISE if very strong).",
    mentalMath: "Compare two numbers: your equity vs equity required. Higher = call/raise.",
  },
};
