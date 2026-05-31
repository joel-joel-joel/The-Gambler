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
        className="ml-1 w-4 h-4 rounded-full bg-gray-600 text-[10px] text-gray-300 hover:bg-gray-500 inline-flex items-center justify-center"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl text-xs">
          <h4 className="font-bold text-white mb-1">{tip.title}</h4>
          <p className="text-gray-300 mb-2">{tip.what}</p>
          <div className="space-y-1.5 text-gray-400">
            <p>
              <span className="text-gray-500">Formula:</span> {tip.formula}
            </p>
            <p>
              <span className="text-gray-500">Example:</span> {tip.example}
            </p>
            <p className="text-yellow-300">
              <span className="text-gray-500">Mental math:</span> {tip.mentalMath}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-2 text-gray-500 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}
