import { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { useTrainingStore } from "../store/trainingStore";
import { usePokerCalculator } from "../hooks/usePokerCalculator";
import { MetricTooltip } from "./MetricTooltip";
import { SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";

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

  const { results, isLoading, error, holeCards, street, prevResults } = useGameStore();
  const { skillProgress, setSkillProgress } = useTrainingStore();

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

  if (isLoading) {
    return <div className="text-center text-stone-400 py-8">Calculating...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">{error}</div>;
  }

  if (!results) return null;

  const actionStyles: Record<string, string> = {
    CALL: "bg-amber-700 shadow-glow",
    RAISE: "bg-emerald-700 shadow-glow",
    FOLD: "bg-red-800",
  };

  return (
    <div className="space-y-4">
      <div
        className={`${actionStyles[results.recommendation.action] || "bg-surface-raised"} rounded-xl p-4 text-center transition-all duration-300`}
      >
        <div className="text-3xl font-black tracking-wide">
          {results.recommendation.action}
        </div>
        <div className="text-sm opacity-80 mt-1">{results.recommendation.reason}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface rounded-lg p-3">
          <div className="flex items-center text-xs text-stone-400 mb-1">
            Equity ({street})
            <MetricTooltip metricKey="equity" />
          </div>
          <div className="text-lg font-bold font-mono text-stone-100">
            {results.equity}%
            <EquityDelta current={results.equity} previous={prevResults?.equity ?? null} />
          </div>
        </div>
        <MetricCard
          label="EV"
          value={`${results.ev >= 0 ? "+" : ""}$${results.ev.toFixed(2)}`}
          metricKey="ev"
          highlight={results.ev >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Pot Odds"
          value={`${results.pot_odds}%`}
          metricKey="pot_odds"
        />
        <MetricCard
          label="Pot Odds Ratio"
          value={results.pot_odds_ratio}
          metricKey="pot_odds_ratio"
        />
        <MetricCard
          label="Equity Required"
          value={`${results.equity_required}%`}
          metricKey="equity_required"
        />
        <OutsCard outs={results.outs} />
        <MetricCard
          label="Rule of 2 & 4"
          value={`~${results.rule_of_2_4}%`}
          metricKey="rule_of_2_4"
        />
        {results.preflop_hand_tier && (
          <MetricCard
            label="Hand Tier"
            value={`Tier ${results.preflop_hand_tier}`}
            metricKey="recommendation"
          />
        )}
      </div>

      {(results.spr !== null || results.mdf !== null) && (
        <div className="border-t border-surface-raised pt-3">
          <h3 className="text-xs text-stone-500 uppercase tracking-wide mb-2">
            Sizing & Pressure
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.spr !== null && (
              <MetricCard label="SPR" value={`${results.spr}`} metricKey="spr" />
            )}
            {results.mdf !== null && (
              <MetricCard label="MDF" value={`${results.mdf}%`} metricKey="mdf" />
            )}
            {results.bet_pot_percentage !== null && (
              <MetricCard
                label="Bet/Pot"
                value={`${results.bet_pot_percentage}%`}
                metricKey="bluff_break_even"
              />
            )}
            {results.effective_stack && (
              <MetricCard
                label="Eff. Stack"
                value={`${results.effective_stack.effective_stack_bb} BB`}
                metricKey="spr"
                subtitle={results.effective_stack.stack_depth}
              />
            )}
          </div>
        </div>
      )}
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
          <div className="text-[10px] text-stone-500 mt-0.5">
            {outs.draws.map((d) => d.draw_type.replace(/_/g, " ")).join(", ") || "none"}
          </div>
          {hasOuts && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1.5 text-[10px] text-gold hover:text-gold-300 flex items-center gap-1 cursor-pointer transition-colors duration-200"
              >
                <span className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
                {expanded ? "Hide" : "Show"} out cards
              </button>
              {expanded && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {outs.outs_cards.map((card) => (
                    <span
                      key={card}
                      className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded bg-surface-raised ${SUIT_COLORS[card[1]]}`}
                    >
                      {card[0]}{SUIT_SYMBOLS[card[1]]}
                    </span>
                  ))}
                </div>
              )}
            </>
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
}

function MetricCard({ label, value, metricKey, subtitle, highlight }: MetricCardProps) {
  const [revealed, setRevealed] = useState(false);
  const { mentalMathMode, graduatedSkills } = useTrainingStore();
  const graduated = graduatedSkills();

  useEffect(() => {
    setRevealed(false);
  }, [value]);

  const skillKey = METRIC_SKILL_MAP[metricKey];
  const shouldBlur = mentalMathMode && !!skillKey && graduated.has(skillKey) && !revealed;

  const highlightClass =
    highlight === "green"
      ? "text-emerald-400"
      : highlight === "red"
        ? "text-red-400"
        : "text-stone-100";

  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="flex items-center text-xs text-stone-400 mb-1">
        {label}
        <MetricTooltip metricKey={metricKey} />
      </div>
      <div
        className={`text-lg font-bold font-mono ${highlightClass} transition-all duration-200 ${shouldBlur ? "blur-sm cursor-pointer select-none" : ""}`}
        onClick={shouldBlur ? () => setRevealed(true) : undefined}
      >
        {value}
      </div>
      {shouldBlur && (
        <div className="text-[10px] text-stone-500 mt-0.5">Calculate first, then tap</div>
      )}
      {!shouldBlur && subtitle && (
        <div className="text-[10px] text-stone-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
