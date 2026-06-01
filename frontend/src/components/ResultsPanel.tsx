import { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { useTrainingStore } from "../store/trainingStore";
import { usePokerCalculator } from "../hooks/usePokerCalculator";
import { MetricTooltip } from "./MetricTooltip";
import { SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";
import type { CalculationResult } from "../types";

const METRIC_SKILL_MAP: Record<string, string> = {
  ev: "the_decision",
  pot_odds: "pot_odds",
  pot_odds_ratio: "pot_odds",
  equity_required: "pot_odds",
  rule_of_2_4: "rule_of_2_4",
  spr: "spr_commitment",
  mdf: "bluff_math",
  bluff_break_even: "bluff_math",
  outs: "outs",
};

const TIER_INFO: Record<number, { label: string; color: string }> = {
  1: { label: "Premium", color: "bg-emerald-800 text-emerald-200" },
  2: { label: "Strong", color: "bg-emerald-900 text-emerald-300" },
  3: { label: "Good", color: "bg-gold-700 text-stone-100" },
  4: { label: "Playable", color: "bg-gold-900 text-gold-200" },
  5: { label: "Marginal", color: "bg-amber-900 text-amber-200" },
  6: { label: "Speculative", color: "bg-amber-950 text-amber-300" },
  7: { label: "Suited / Connected", color: "bg-amber-950 text-amber-300" },
  8: { label: "Weak", color: "bg-red-900 text-red-300" },
  9: { label: "Very Weak", color: "bg-red-950 text-red-400" },
  10: { label: "Trash", color: "bg-red-950 text-red-500" },
};

interface BreakdownLine {
  label: string;
  value: string;
}

interface CalcBreakdown {
  formula: string;
  variables: BreakdownLine[];
  steps: string[];
}

function getBreakdown(
  metricKey: string,
  results: CalculationResult,
  potSize: number,
  betToCall: number,
  numPlayers: number,
  yourStack: number | null,
  villainStack: number | null,
  street: string,
): CalcBreakdown | null {
  switch (metricKey) {
    case "equity":
      return {
        formula: "Monte Carlo simulation (10,000 iterations)",
        variables: [
          { label: "Opponents", value: `${numPlayers - 1}` },
          { label: "Street", value: street },
        ],
        steps: [
          `Deal ${numPlayers - 1} random opponent hand(s)`,
          "Deal remaining community cards",
          "Evaluate all hands, count wins",
          `Win rate: ${results.equity}%`,
        ],
      };
    case "ev":
      return {
        formula: "(equity × pot after call) − ((1 − equity) × bet to call)",
        variables: [
          { label: "Equity", value: `${results.equity}%` },
          { label: "Pot", value: `$${potSize}` },
          { label: "Bet to call", value: `$${betToCall}` },
          { label: "Pot after call", value: `$${potSize + betToCall}` },
        ],
        steps: [
          `Win: ${(results.equity / 100).toFixed(2)} × $${potSize + betToCall} = $${((results.equity / 100) * (potSize + betToCall)).toFixed(2)}`,
          `Lose: ${(1 - results.equity / 100).toFixed(2)} × $${betToCall} = −$${((1 - results.equity / 100) * betToCall).toFixed(2)}`,
          `EV = $${((results.equity / 100) * (potSize + betToCall)).toFixed(2)} − $${((1 - results.equity / 100) * betToCall).toFixed(2)} = ${results.ev >= 0 ? "+" : ""}$${results.ev.toFixed(2)}`,
        ],
      };
    case "pot_odds":
      return {
        formula: "bet to call ÷ (pot + bet to call) × 100",
        variables: [
          { label: "Bet to call", value: `$${betToCall}` },
          { label: "Pot", value: `$${potSize}` },
          { label: "Total pot", value: `$${potSize + betToCall}` },
        ],
        steps: [
          `$${betToCall} ÷ $${potSize + betToCall} = ${((betToCall / (potSize + betToCall)) * 100).toFixed(1)}%`,
        ],
      };
    case "pot_odds_ratio":
      return {
        formula: "pot : bet to call",
        variables: [
          { label: "Pot", value: `$${potSize}` },
          { label: "Bet to call", value: `$${betToCall}` },
        ],
        steps: [
          `$${potSize} : $${betToCall} = ${results.pot_odds_ratio}`,
        ],
      };
    case "equity_required":
      return {
        formula: "Same as pot odds — you need at least this equity to call",
        variables: [
          { label: "Bet to call", value: `$${betToCall}` },
          { label: "Pot", value: `$${potSize}` },
        ],
        steps: [
          `$${betToCall} ÷ ($${potSize} + $${betToCall}) = ${results.equity_required}%`,
          `Your equity: ${results.equity}% ${results.equity >= results.equity_required ? "≥" : "<"} ${results.equity_required}%`,
        ],
      };
    case "rule_of_2_4": {
      const multiplier = street === "flop" ? 4 : 2;
      const rule = street === "flop" ? "Rule of 4 (flop → river)" : "Rule of 2 (turn → river)";
      return {
        formula: `outs × ${multiplier} (${rule})`,
        variables: [
          { label: "Outs", value: `${results.outs.total_outs}` },
          { label: "Street", value: street },
          { label: "Multiplier", value: `×${multiplier}` },
        ],
        steps: [
          `${results.outs.total_outs} × ${multiplier} = ~${results.rule_of_2_4}%`,
        ],
      };
    }
    case "spr":
      if (results.spr === null || !results.effective_stack) return null;
      return {
        formula: "effective stack ÷ pot size",
        variables: [
          { label: "Effective stack", value: `$${results.effective_stack.effective_stack}` },
          { label: "Pot", value: `$${potSize}` },
        ],
        steps: [
          `$${results.effective_stack.effective_stack} ÷ $${potSize} = ${results.spr}`,
          results.spr < 3 ? "Low SPR — you're committed" : results.spr > 10 ? "High SPR — deep stacked, be cautious" : "Medium SPR — standard play",
        ],
      };
    case "mdf":
      if (results.mdf === null) return null;
      return {
        formula: "1 − (bet ÷ (pot + bet)) × 100",
        variables: [
          { label: "Bet", value: `$${betToCall}` },
          { label: "Pot", value: `$${potSize}` },
        ],
        steps: [
          `1 − ($${betToCall} ÷ $${potSize + betToCall}) = ${results.mdf}%`,
          "You must defend at least this % of hands to prevent profitable bluffs",
        ],
      };
    case "bluff_break_even":
      if (results.bet_pot_percentage === null) return null;
      return {
        formula: "bet ÷ pot × 100",
        variables: [
          { label: "Bet", value: `$${betToCall}` },
          { label: "Pot", value: `$${potSize}` },
        ],
        steps: [
          `$${betToCall} ÷ $${potSize} = ${results.bet_pot_percentage}%`,
        ],
      };
    default:
      return null;
  }
}

function BreakdownPanel({ breakdown }: { breakdown: CalcBreakdown }) {
  return (
    <div className="mt-2 pt-2 border-t border-surface-raised text-[10px] space-y-1.5">
      <div className="text-gold-300 font-mono">{breakdown.formula}</div>
      <div className="space-y-0.5">
        {breakdown.variables.map((v) => (
          <div key={v.label} className="flex justify-between text-stone-400">
            <span>{v.label}</span>
            <span className="font-mono text-stone-300">{v.value}</span>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 text-stone-300 font-mono">
        {breakdown.steps.map((step, i) => (
          <div key={i}>{i === breakdown.steps.length - 1 ? `→ ${step}` : step}</div>
        ))}
      </div>
    </div>
  );
}

function PreflopTierBanner({ tier }: { tier: number }) {
  const info = TIER_INFO[tier] ?? { label: `Tier ${tier}`, color: "bg-surface-raised text-stone-300" };
  return (
    <div className={`${info.color} rounded-lg px-4 py-3 flex items-center`}>
      <span className="font-bold text-lg">Tier {tier}</span>
      <span className="ml-2 text-sm opacity-80">{info.label}</span>
    </div>
  );
}

function EquityDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return null;
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`text-xs font-mono ${color} ml-1`}>
      ({sign}{delta.toFixed(1)}%)
    </span>
  );
}

export function ResultsPanel() {
  usePokerCalculator();

  const { results: liveResults, isLoading, error, holeCards, street, prevResults, viewingStreet, streetResults, setViewingStreet, potSize, betToCall, numPlayers, yourStack, villainStack } = useGameStore();
  const { skillProgress, setSkillProgress } = useTrainingStore();

  const isViewingPast = viewingStreet !== null && viewingStreet !== street;
  const results = isViewingPast ? (streetResults[viewingStreet] ?? null) : liveResults;
  const displayStreet = isViewingPast ? viewingStreet : street;

  useEffect(() => {
    if (skillProgress.length === 0) {
      fetch("/api/drills/progress")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setSkillProgress(data))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (holeCards.length < 2) {
    return (
      <div className="text-center text-stone-500 py-8">
        Select 2 hole cards to see calculations
      </div>
    );
  }

  if (isLoading && !isViewingPast) {
    return <div className="text-center text-stone-400 py-8">Calculating...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">{error}</div>;
  }

  if (!results) return null;

  const actionStyles: Record<string, string> = {
    CHECK: "bg-sky-800 shadow-glow",
    CALL: "bg-amber-700 shadow-glow",
    RAISE: "bg-emerald-700 shadow-glow",
    FOLD: "bg-red-800",
  };

  return (
    <div className="space-y-4">
      {isViewingPast && (
        <div className="flex items-center justify-between bg-gold/10 border border-gold/30 rounded-lg px-4 py-2">
          <span className="text-xs text-gold">
            Viewing <span className="font-semibold capitalize">{viewingStreet}</span> results
          </span>
          <button
            onClick={() => setViewingStreet(null)}
            className="text-xs text-gold hover:text-gold-400 cursor-pointer transition-colors duration-200"
          >
            Back to live
          </button>
        </div>
      )}
      <div
        className={`${actionStyles[results.recommendation.action] || "bg-surface-raised"} rounded-xl p-4 text-center transition-all duration-300`}
      >
        <div className="text-3xl font-black tracking-wide">
          {results.recommendation.action}
        </div>
        <div className="text-sm opacity-80 mt-1">{results.recommendation.reason}</div>
        {results.recommendation.raise_sizing && (
          <div className="text-sm font-mono mt-2 opacity-90">
            {results.recommendation.raise_sizing.reasoning}
          </div>
        )}
      </div>

      {results.preflop_hand_tier && (
        <PreflopTierBanner tier={results.preflop_hand_tier} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EquityCard results={results} displayStreet={displayStreet} prevEquity={prevResults?.equity ?? null} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack} />
        <MetricCard
          label="EV"
          value={`${results.ev >= 0 ? "+" : ""}$${results.ev.toFixed(2)}`}
          metricKey="ev"
          highlight={results.ev >= 0 ? "green" : "red"}
          results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
        />
        <MetricCard
          label="Pot Odds"
          value={`${results.pot_odds}%`}
          metricKey="pot_odds"
          results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
        />
        <MetricCard
          label="Pot Odds Ratio"
          value={results.pot_odds_ratio}
          metricKey="pot_odds_ratio"
          results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
        />
        <MetricCard
          label="Equity Required"
          value={`${results.equity_required}%`}
          metricKey="equity_required"
          results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
        />
        <OutsCard outs={results.outs} />
        <MetricCard
          label="Rule of 2 & 4"
          value={`~${results.rule_of_2_4}%`}
          metricKey="rule_of_2_4"
          results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
        />
      </div>

      {(results.spr !== null || results.mdf !== null) && (
        <div className="border-t border-surface-raised pt-3">
          <h3 className="text-xs text-stone-500 uppercase tracking-wide mb-2">
            Sizing & Pressure
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.spr !== null && (
              <MetricCard label="SPR" value={`${results.spr}`} metricKey="spr" results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack} />
            )}
            {results.mdf !== null && (
              <MetricCard label="MDF" value={`${results.mdf}%`} metricKey="mdf" results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack} />
            )}
            {results.bet_pot_percentage !== null && (
              <MetricCard
                label="Bet/Pot"
                value={`${results.bet_pot_percentage}%`}
                metricKey="bluff_break_even"
                results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
              />
            )}
            {results.effective_stack && (
              <MetricCard
                label="Eff. Stack"
                value={`${results.effective_stack.effective_stack_bb} BB`}
                metricKey="spr"
                subtitle={results.effective_stack.stack_depth}
                results={results} potSize={potSize} betToCall={betToCall} numPlayers={numPlayers} yourStack={yourStack} villainStack={villainStack}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EquityCard({
  results,
  displayStreet,
  prevEquity,
  potSize,
  betToCall,
  numPlayers,
  yourStack,
  villainStack,
}: {
  results: CalculationResult;
  displayStreet: string;
  prevEquity: number | null;
  potSize: number;
  betToCall: number;
  numPlayers: number;
  yourStack: number | null;
  villainStack: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const breakdown = getBreakdown("equity", results, potSize, betToCall, numPlayers, yourStack, villainStack, results.street);

  return (
    <div
      className="bg-surface rounded-lg p-3 cursor-pointer hover:bg-surface-hover transition-colors duration-150"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center text-xs text-stone-400 mb-1">
        <span className={`transition-transform duration-200 inline-block mr-1 text-[8px] text-stone-500 ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
        Equity ({displayStreet})
        <MetricTooltip metricKey="equity" />
      </div>
      <div className="text-lg font-bold font-mono text-stone-100">
        {results.equity}%
        <EquityDelta current={results.equity} previous={prevEquity} />
      </div>
      {expanded && breakdown && <BreakdownPanel breakdown={breakdown} />}
    </div>
  );
}

function OutsCard({ outs }: { outs: import("../types").OutsData }) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { mentalMathMode, graduatedSkills } = useTrainingStore();
  const graduated = graduatedSkills();
  const hasOuts = outs.total_outs > 0;

  const shouldBlur = mentalMathMode && graduated.has("outs") && !revealed;

  useEffect(() => {
    setRevealed(false);
  }, [outs.total_outs]);

  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="flex items-center text-xs text-stone-400 mb-1">
        Outs
        <MetricTooltip metricKey="outs" />
      </div>
      <div
        className={`text-lg font-bold font-mono text-stone-100 transition-all duration-200 ${shouldBlur ? "blur-sm cursor-pointer select-none" : ""}`}
        onClick={shouldBlur ? () => setRevealed(true) : undefined}
      >
        {outs.total_outs}
      </div>
      {shouldBlur ? (
        <div className="text-[10px] text-stone-500 mt-0.5">Calculate first, then tap</div>
      ) : (
        <>
          {hasOuts ? (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-[10px] text-gold hover:text-gold-300 flex items-center gap-1 cursor-pointer transition-colors duration-200"
              >
                <span className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
                {expanded ? "Hide" : "Show"} breakdown
              </button>
              {expanded && (
                <div className="mt-1.5 pt-1.5 border-t border-surface-raised space-y-1.5">
                  <div className="space-y-0.5">
                    {outs.draws.map((d) => (
                      <div key={d.draw_type} className="flex justify-between text-[10px] text-stone-400">
                        <span>{d.draw_type.replace(/_/g, " ")}</span>
                        <span className="font-mono text-stone-300">{d.outs} outs</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[10px] text-stone-200 font-semibold pt-0.5 border-t border-surface-raised">
                      <span>Total</span>
                      <span className="font-mono">{outs.total_outs} outs</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {outs.outs_cards.map((card) => (
                      <span
                        key={card}
                        className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded bg-surface-raised ${SUIT_COLORS[card[1]]}`}
                      >
                        {card[0]}{SUIT_SYMBOLS[card[1]]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-[10px] text-stone-500 mt-0.5">none</div>
          )}
        </>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  metricKey: string;
  subtitle?: string;
  highlight?: "green" | "red";
  results: CalculationResult;
  potSize: number;
  betToCall: number;
  numPlayers: number;
  yourStack: number | null;
  villainStack: number | null;
}

function MetricCard({ label, value, metricKey, subtitle, highlight, results, potSize, betToCall, numPlayers, yourStack, villainStack }: MetricCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { mentalMathMode, graduatedSkills } = useTrainingStore();
  const graduated = graduatedSkills();

  useEffect(() => {
    setRevealed(false);
    setExpanded(false);
  }, [value]);

  const skillKey = METRIC_SKILL_MAP[metricKey];
  const shouldBlur = mentalMathMode && !!skillKey && graduated.has(skillKey) && !revealed;

  const highlightClass =
    highlight === "green"
      ? "text-emerald-400"
      : highlight === "red"
        ? "text-red-400"
        : "text-stone-100";

  const breakdown = getBreakdown(metricKey, results, potSize, betToCall, numPlayers, yourStack, villainStack, results.street);

  const handleClick = () => {
    if (shouldBlur) {
      setRevealed(true);
    } else if (breakdown) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`bg-surface rounded-lg p-3 ${breakdown && !shouldBlur ? "cursor-pointer hover:bg-surface-hover" : ""} transition-colors duration-150`}
      onClick={handleClick}
    >
      <div className="flex items-center text-xs text-stone-400 mb-1">
        {breakdown && !shouldBlur && (
          <span className={`transition-transform duration-200 inline-block mr-1 text-[8px] text-stone-500 ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
        )}
        {label}
        <MetricTooltip metricKey={metricKey} />
      </div>
      <div
        className={`text-lg font-bold font-mono ${highlightClass} transition-all duration-200 ${shouldBlur ? "blur-sm cursor-pointer select-none" : ""}`}
      >
        {value}
      </div>
      {shouldBlur && (
        <div className="text-[10px] text-stone-500 mt-0.5">Calculate first, then tap</div>
      )}
      {!shouldBlur && subtitle && (
        <div className="text-[10px] text-stone-500 mt-0.5">{subtitle}</div>
      )}
      {expanded && breakdown && !shouldBlur && <BreakdownPanel breakdown={breakdown} />}
    </div>
  );
}
