import { useGameStore } from "../store/gameStore";
import { usePokerCalculator } from "../hooks/usePokerCalculator";
import { MetricTooltip } from "./MetricTooltip";

export function ResultsPanel() {
  usePokerCalculator();

  const { results, isLoading, error, holeCards } = useGameStore();

  if (holeCards.length < 2) {
    return (
      <div className="text-center text-gray-500 py-8">
        Select 2 hole cards to see calculations
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-8">Calculating...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">{error}</div>;
  }

  if (!results) return null;

  const actionColors: Record<string, string> = {
    CALL: "bg-yellow-600",
    RAISE: "bg-green-600",
    FOLD: "bg-red-600",
  };

  return (
    <div className="space-y-4">
      {/* Recommendation — most prominent */}
      <div
        className={`${actionColors[results.recommendation.action] || "bg-gray-700"} rounded-xl p-4 text-center`}
      >
        <div className="text-3xl font-black tracking-wide">
          {results.recommendation.action}
        </div>
        <div className="text-sm opacity-80 mt-1">{results.recommendation.reason}</div>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Equity"
          value={`${results.equity}%`}
          metricKey="equity"
        />
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
        <MetricCard
          label="Outs"
          value={`${results.outs.total_outs}`}
          metricKey="outs"
          subtitle={results.outs.draws.map((d) => d.draw_type.replace(/_/g, " ")).join(", ") || "none"}
        />
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

      {/* Study metrics (SPR, MDF, etc.) */}
      {(results.spr !== null || results.mdf !== null) && (
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
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

interface MetricCardProps {
  label: string;
  value: string;
  metricKey: string;
  subtitle?: string;
  highlight?: "green" | "red";
}

function MetricCard({ label, value, metricKey, subtitle, highlight }: MetricCardProps) {
  const highlightClass =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
        ? "text-red-400"
        : "text-white";

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center text-xs text-gray-400 mb-1">
        {label}
        <MetricTooltip metricKey={metricKey} />
      </div>
      <div className={`text-lg font-bold ${highlightClass}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
