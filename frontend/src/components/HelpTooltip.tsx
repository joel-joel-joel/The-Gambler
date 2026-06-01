import { useState, useRef, useEffect } from "react";

interface HelpTooltipProps {
  title: string;
  children: React.ReactNode;
}

export function HelpTooltip({ title, children }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1.5 w-4 h-4 rounded-full bg-surface-raised text-stone-400 text-[10px] font-bold leading-none hover:bg-surface-hover hover:text-gold inline-flex items-center justify-center transition-colors duration-200 cursor-pointer"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-surface border border-surface-raised rounded-lg p-3 shadow-xl text-xs text-stone-300">
          <div className="font-semibold text-stone-100 mb-1.5">{title}</div>
          {children}
        </div>
      )}
    </div>
  );
}
