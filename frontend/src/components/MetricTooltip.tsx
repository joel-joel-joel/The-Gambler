import { useState, useRef, useCallback } from "react";
import { tooltips } from "../utils/tooltipData";

interface MetricTooltipProps {
  metricKey: string;
}

export function MetricTooltip({ metricKey }: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tip = tooltips[metricKey];

  const show = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setIsOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  if (!tip) return null;

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className="ml-1 w-4 h-4 rounded-full bg-surface-raised text-[10px] text-stone-400 hover:bg-surface-hover hover:text-gold inline-flex items-center justify-center transition-colors duration-200 cursor-help"
      >
        ?
      </span>
      {isOpen && (
        <div
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-surface border border-surface-raised rounded-lg p-3 shadow-xl text-xs"
        >
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
        </div>
      )}
    </span>
  );
}
