import { useState } from "react";
import { tooltips } from "../utils/tooltipData";

interface MetricTooltipProps {
  metricKey: string;
}

export function MetricTooltip({ metricKey }: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tip = tooltips[metricKey];

  if (!tip) return null;

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 w-4 h-4 rounded-full bg-surface-raised text-[10px] text-stone-400 hover:bg-surface-hover hover:text-gold inline-flex items-center justify-center transition-colors duration-200 cursor-pointer"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-surface border border-surface-raised rounded-lg p-3 shadow-xl text-xs">
          <h4 className="font-bold text-stone-100 mb-1">{tip.title}</h4>
          <p className="text-stone-300 mb-2">{tip.what}</p>
          <div className="space-y-1.5 text-stone-400">
            <p>
              <span className="text-stone-500">Formula:</span> {tip.formula}
            </p>
            <p>
              <span className="text-stone-500">Example:</span> {tip.example}
            </p>
            <p className="text-gold-300">
              <span className="text-stone-500">Mental math:</span> {tip.mentalMath}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-2 text-stone-500 hover:text-stone-200 cursor-pointer transition-colors duration-200"
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}
