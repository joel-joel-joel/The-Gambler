import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "../store/gameStore";

const VALID_RANKS = new Set("23456789TJQKA".split(""));
const VALID_SUITS = new Set("SHDC".split(""));
const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"] as const;

type Step = "card1" | "card2" | "pot" | "bet" | "position" | "players";

const STEP_CONFIG: Record<Step, { label: string; placeholder: string }> = {
  card1: { label: "Card 1", placeholder: "e.g. AS, Kh, 2d" },
  card2: { label: "Card 2", placeholder: "e.g. KC, Th, 9s" },
  pot: { label: "Pot Size", placeholder: "$" },
  bet: { label: "Bet to Call", placeholder: "$" },
  position: { label: "Position", placeholder: "UTG/MP/CO/BTN/SB/BB" },
  players: { label: "Players", placeholder: "2-9" },
};

const STEP_ORDER: Step[] = ["card1", "card2", "pot", "bet", "position", "players"];

function parseCard(input: string): string | null {
  const s = input.trim().toUpperCase();
  if (s.length !== 2) return null;
  const rank = s[0];
  const suit = s[1];
  if (!VALID_RANKS.has(rank) || !VALID_SUITS.has(suit)) return null;
  return rank + suit.toLowerCase();
}

export function QuickEntryBar() {
  const [step, setStep] = useState<Step>("card1");
  const [input, setInput] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    setHoleCards,
    setPotSize,
    setBetToCall,
    setPosition,
    setNumPlayers,
    resetAll,
  } = useGameStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const applyAll = useCallback((vals: Record<string, string>) => {
    const c1 = parseCard(vals.card1 || "");
    const c2 = parseCard(vals.card2 || "");
    if (c1 && c2) setHoleCards([c1, c2]);
    if (vals.pot) setPotSize(Number(vals.pot));
    if (vals.bet) setBetToCall(Number(vals.bet));
    if (vals.position) setPosition(vals.position.toUpperCase());
    if (vals.players) setNumPlayers(Number(vals.players));
  }, [setHoleCards, setPotSize, setBetToCall, setPosition, setNumPlayers]);

  function validate(s: Step, value: string): string | null {
    const v = value.trim();
    if (!v) return null;
    switch (s) {
      case "card1":
      case "card2": {
        if (!parseCard(v)) return "Enter rank + suit (e.g. AS, Kh, 2d)";
        return null;
      }
      case "pot":
      case "bet": {
        const n = Number(v);
        if (isNaN(n) || n < 0) return "Enter a positive number";
        return null;
      }
      case "position": {
        if (!POSITIONS.includes(v.toUpperCase() as typeof POSITIONS[number]))
          return "UTG, MP, CO, BTN, SB, or BB";
        return null;
      }
      case "players": {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 2 || n > 9) return "2-9 players";
        return null;
      }
    }
  }

  function advance() {
    const v = input.trim();

    if (v) {
      const err = validate(step, v);
      if (err) {
        setError(err);
        return;
      }
    }

    const next = { ...values };
    if (v) next[step] = v;
    setValues(next);
    setError(null);
    setInput("");

    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
    } else {
      applyAll(next);
      setValues({});
      setStep("card1");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      advance();
    }
  }

  function handleNewRound() {
    resetAll();
    setValues({});
    setInput("");
    setError(null);
    setStep("card1");
  }

  const config = STEP_CONFIG[step];
  const stepIdx = STEP_ORDER.indexOf(step);

  const filledTags = STEP_ORDER.slice(0, stepIdx)
    .filter((s) => values[s])
    .map((s) => {
      const display = s === "card1" || s === "card2"
        ? (values[s] || "").toUpperCase()
        : s === "position"
          ? (values[s] || "").toUpperCase()
          : s === "pot"
            ? `$${values[s]}`
            : s === "bet"
              ? `$${values[s]}`
              : `${values[s]}p`;
      return { key: s, label: STEP_CONFIG[s].label, display };
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {filledTags.map((tag) => (
          <span
            key={tag.key}
            className="px-2 py-1 bg-surface-raised text-stone-300 text-xs rounded font-mono"
          >
            {tag.label}: <span className="text-gold">{tag.display}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-stone-400 w-16 flex-shrink-0 text-right">
          {config.label}
        </span>
        {step === "position" ? (
          <div className="flex gap-1 flex-1">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => {
                  const next = { ...values, position: pos };
                  setValues(next);
                  setError(null);
                  setInput("");
                  const idx = STEP_ORDER.indexOf("position");
                  if (idx < STEP_ORDER.length - 1) {
                    setStep(STEP_ORDER[idx + 1]);
                  } else {
                    applyAll(next);
                    setValues({});
                    setStep("card1");
                  }
                }}
                className="px-2 py-1.5 bg-surface border border-surface-raised rounded text-xs text-stone-300 hover:border-gold hover:text-gold transition-colors duration-200 cursor-pointer"
              >
                {pos}
              </button>
            ))}
            <button
              onClick={() => {
                setError(null);
                setInput("");
                const idx = STEP_ORDER.indexOf("position");
                if (idx < STEP_ORDER.length - 1) {
                  setStep(STEP_ORDER[idx + 1]);
                }
              }}
              className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors duration-200 cursor-pointer"
            >
              Skip
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            className="flex-1 bg-surface border border-surface-raised rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
            autoFocus
          />
        )}
        {step !== "position" && (
          <button
            onClick={advance}
            className="px-3 py-2 bg-gold text-stone-900 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
          >
            {stepIdx === STEP_ORDER.length - 1 ? "Done" : "Next"}
          </button>
        )}
        {step !== "position" && step !== "card1" && (
          <button
            onClick={() => {
              setInput("");
              setError(null);
              advance();
            }}
            className="px-2 py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors duration-200 cursor-pointer"
          >
            Skip
          </button>
        )}
        <button
          onClick={handleNewRound}
          className="px-2 py-2 text-xs text-stone-500 hover:text-red-400 transition-colors duration-200 cursor-pointer"
          title="Clear and start new round"
        >
          Reset
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 ml-18">{error}</p>
      )}
      <div className="flex gap-1 ml-18">
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i < stepIdx
                ? "bg-gold"
                : i === stepIdx
                  ? "bg-gold/50"
                  : "bg-surface-raised"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
