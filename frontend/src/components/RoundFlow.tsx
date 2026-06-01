import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "../store/gameStore";
import { useSession } from "../hooks/useSession";
import { SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";
import type { Street } from "../types";

const VALID_RANKS = new Set("23456789TJQKA".split(""));
const VALID_SUITS = new Set("SHDC".split(""));
const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"] as const;

type FieldType = "card" | "number" | "position" | "players";

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type: FieldType;
  required?: boolean;
}

const STREET_LABELS: Record<Street, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

const COMMUNITY_CARD_COUNTS: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

const CARD_FIELD_LABELS: Record<number, string> = {
  0: "Flop 1", 1: "Flop 2", 2: "Flop 3", 3: "Turn", 4: "River",
};

function buildFieldsForStreet(
  targetStreet: Street,
  holeCards: string[],
  communityCards: string[],
  position: string | null,
): FieldDef[] {
  const fields: FieldDef[] = [];

  if (holeCards.length < 1) {
    fields.push({ key: "card1", label: "Card 1", placeholder: "AS, Kh, 2d", type: "card", required: true });
  }
  if (holeCards.length < 2) {
    fields.push({ key: "card2", label: "Card 2", placeholder: "KC, Th, 9s", type: "card", required: true });
  }

  const neededCommunity = COMMUNITY_CARD_COUNTS[targetStreet];
  for (let i = communityCards.length; i < neededCommunity; i++) {
    fields.push({
      key: `community_${i}`,
      label: CARD_FIELD_LABELS[i] ?? `Card ${i + 1}`,
      placeholder: "e.g. Qh",
      type: "card",
      required: true,
    });
  }

  fields.push({ key: "pot", label: "Pot", placeholder: "$", type: "number" });
  fields.push({ key: "bet", label: "Bet", placeholder: "$", type: "number" });
  fields.push({ key: "players", label: "Players", placeholder: "2-9", type: "players" });

  if (!position) {
    fields.push({ key: "position", label: "Position", placeholder: "", type: "position" });
  }

  return fields;
}

function PositionKeyListener({ onSelect, onSkip }: { onSelect: (pos: string) => void; onSkip: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) {
        e.preventDefault();
        onSelect(POSITIONS[n - 1]);
      } else if (e.key === "0" || e.key === "Enter") {
        e.preventDefault();
        onSkip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect, onSkip]);
  return null;
}

function parseCard(input: string): string | null {
  const s = input.trim().toUpperCase();
  if (s.length !== 2) return null;
  if (!VALID_RANKS.has(s[0]) || !VALID_SUITS.has(s[1])) return null;
  return s[0] + s[1].toLowerCase();
}

function CardChip({ code }: { code: string }) {
  const suit = code[1];
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs px-1.5 py-0.5 rounded bg-surface-raised ${SUIT_COLORS[suit]}`}>
      {code[0]}{SUIT_SYMBOLS[suit]}
    </span>
  );
}

interface AppliedEntry {
  field: FieldDef;
  value: string;
  prevHoleCards: string[];
  prevCommunityCards: string[];
  prevPotSize: number;
  prevBetToCall: number;
  prevNumPlayers: number;
  prevPosition: string | null;
}

export function RoundFlow() {
  const {
    street, holeCards, communityCards, potSize, betToCall, numPlayers, position,
    setHoleCards, setCommunityCards, setPotSize, setBetToCall, setNumPlayers, setPosition,
    setStreet, nextStreet, foldRound, roundKey,
  } = useGameStore();
  const { activeSession, saveRound } = useSession();

  const [fields, setFields] = useState<FieldDef[]>(() =>
    buildFieldsForStreet(street, holeCards, communityCards, position)
  );
  const [fieldIdx, setFieldIdx] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [applied, setApplied] = useState<AppliedEntry[]>([]);
  const [savedToast, setSavedToast] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rebuild fields when street or roundKey changes
  useEffect(() => {
    const s = useGameStore.getState();
    const newFields = buildFieldsForStreet(s.street, s.holeCards, s.communityCards, s.position);
    setFields(newFields);
    setFieldIdx(0);
    setInput("");
    setError(null);
    setCompleted(newFields.length === 0);
    setApplied([]);
  }, [street, roundKey]);

  useEffect(() => {
    if (!completed) {
      inputRef.current?.focus();
    }
  }, [fieldIdx, completed]);

  const currentField = fields[fieldIdx] as FieldDef | undefined;

  const getCarryForward = useCallback((field: FieldDef): string => {
    switch (field.key) {
      case "pot": return potSize > 0 ? String(potSize) : "";
      case "bet": return betToCall > 0 ? String(betToCall) : "";
      case "players": return String(numPlayers);
      default: return "";
    }
  }, [potSize, betToCall, numPlayers]);

  function validate(field: FieldDef, value: string): string | null {
    const v = value.trim();
    if (!v) {
      if (field.required) return `${field.label} is required`;
      return null;
    }
    switch (field.type) {
      case "card": {
        if (!parseCard(v)) return "Rank + suit (e.g. AS, Kh, 2d)";
        const card = parseCard(v)!;
        const allCards = [...holeCards, ...communityCards];
        if (allCards.includes(card)) return "Card already dealt";
        return null;
      }
      case "number": {
        const n = Number(v);
        if (isNaN(n) || n < 0) return "Enter a positive number";
        return null;
      }
      case "players": {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 2 || n > 9) return "2-9 players";
        return null;
      }
      default: return null;
    }
  }

  function snapshot(): Omit<AppliedEntry, "field" | "value"> {
    return {
      prevHoleCards: [...holeCards],
      prevCommunityCards: [...communityCards],
      prevPotSize: potSize,
      prevBetToCall: betToCall,
      prevNumPlayers: numPlayers,
      prevPosition: position,
    };
  }

  function applyField(field: FieldDef, value: string) {
    const v = value.trim();
    if (!v) return;

    switch (field.type) {
      case "card": {
        const card = parseCard(v)!;
        if (field.key === "card1" || field.key === "card2") {
          setHoleCards([...holeCards, card]);
        } else {
          setCommunityCards([...communityCards, card]);
        }
        break;
      }
      case "number": {
        const n = Number(v);
        if (field.key === "pot") setPotSize(n);
        else if (field.key === "bet") setBetToCall(n);
        break;
      }
      case "position":
        setPosition(v.toUpperCase());
        break;
      case "players":
        setNumPlayers(Number(v));
        break;
    }
  }

  function advance(overrideValue?: string) {
    if (!currentField) return;

    const value = overrideValue ?? input.trim();
    const carry = getCarryForward(currentField);
    const effectiveValue = value || carry;

    if (effectiveValue) {
      const err = validate(currentField, effectiveValue);
      if (err) {
        setError(err);
        return;
      }
      const snap = snapshot();
      applyField(currentField, effectiveValue);
      setApplied([...applied, { field: currentField, value: effectiveValue, ...snap }]);
    } else if (currentField.required) {
      setError(`${currentField.label} is required`);
      return;
    } else {
      setApplied([...applied, { field: currentField, value: "", ...snapshot() }]);
    }

    setError(null);
    setInput("");

    if (fieldIdx < fields.length - 1) {
      setFieldIdx(fieldIdx + 1);
    } else {
      setCompleted(true);
    }
  }

  function goBack() {
    if (applied.length === 0) return;
    const last = applied[applied.length - 1];
    setHoleCards(last.prevHoleCards);
    setCommunityCards(last.prevCommunityCards);
    setPotSize(last.prevPotSize);
    setBetToCall(last.prevBetToCall);
    setNumPlayers(last.prevNumPlayers);
    setPosition(last.prevPosition);
    setApplied(applied.slice(0, -1));
    setFieldIdx(fieldIdx > 0 ? fieldIdx - 1 : 0);
    setCompleted(false);
    setInput("");
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      advance();
    } else if (e.key === "Backspace" && input === "") {
      e.preventDefault();
      goBack();
    }
  }

  function jumpToStreet(target: Street) {
    if (target === street && !completed) return;
    setStreet(target);
    // rebuildFields fires via the useEffect on street change
  }

  function handleSaveRound() {
    if (!activeSession) {
      foldRound();
      return;
    }
    setSavedToast(true);
    saveRound(null, 0);
    setTimeout(() => {
      foldRound();
      setSavedToast(false);
    }, 1500);
  }

  // Global keyboard shortcuts when street is completed
  useEffect(() => {
    if (!completed || savedToast) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (street === "river" && (e.key === "Enter" || e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSaveRound();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        nextStreet();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        foldRound();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completed, street, savedToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const streetIdx = STREET_ORDER.indexOf(street);
  const isLastStreet = street === "river";

  return (
    <div className="space-y-3">
      {/* Saved toast */}
      {savedToast && (
        <div className="bg-emerald-900 border border-emerald-700 text-emerald-200 text-sm px-4 py-2 rounded-lg text-center">
          Round saved! Resetting...
        </div>
      )}

      {/* Street progress bar — clickable */}
      <div className="flex items-center gap-2">
        {STREET_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => jumpToStreet(s)}
              className={`flex-1 text-center text-xs font-semibold py-1.5 rounded cursor-pointer transition-colors duration-200 ${
                i < streetIdx ? "bg-gold/20 text-gold hover:bg-gold/30" :
                i === streetIdx ? "bg-gold text-stone-900" :
                "bg-surface-raised text-stone-500 hover:bg-surface-hover hover:text-stone-300"
              }`}
            >
              {STREET_LABELS[s]}
            </button>
            {i < STREET_ORDER.length - 1 && (
              <span className={`text-xs ${i < streetIdx ? "text-gold" : "text-surface-raised"}`}>→</span>
            )}
          </div>
        ))}
      </div>

      {/* Dealt cards summary */}
      {holeCards.length > 0 && (
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-stone-400 text-xs">Hand:</span>
          <div className="flex gap-1">
            {holeCards.map(c => <CardChip key={c} code={c} />)}
          </div>
          {communityCards.length > 0 && (
            <>
              <span className="text-stone-400 text-xs">Board:</span>
              <div className="flex gap-1">
                {communityCards.map(c => <CardChip key={c} code={c} />)}
              </div>
            </>
          )}
          {position && (
            <span className="text-xs text-stone-400">
              Pos: <span className="text-gold font-mono">{position}</span>
            </span>
          )}
          {potSize > 0 && (
            <span className="text-xs text-stone-400">
              Pot: <span className="font-mono text-stone-200">${potSize}</span>
            </span>
          )}
          {betToCall > 0 && (
            <span className="text-xs text-stone-400">
              Bet: <span className="font-mono text-stone-200">${betToCall}</span>
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      {!completed && currentField && (
        <div className="flex gap-2 items-center">
          {applied.length > 0 && (
            <button
              onClick={goBack}
              className="px-2 py-2 text-xs text-stone-500 hover:text-gold transition-colors duration-200 cursor-pointer"
              title="Go back (Backspace)"
            >
              ←
            </button>
          )}
          <span className="text-xs text-stone-400 w-16 flex-shrink-0 text-right font-semibold">
            {currentField.label}
          </span>

          {currentField.type === "position" ? (
            <div className="flex gap-1 flex-1 items-center">
              {POSITIONS.map((pos, i) => (
                <button
                  key={pos}
                  onClick={() => {
                    const snap = snapshot();
                    applyField(currentField, pos);
                    setApplied([...applied, { field: currentField, value: pos, ...snap }]);
                    setError(null);
                    setInput("");
                    if (fieldIdx < fields.length - 1) {
                      setFieldIdx(fieldIdx + 1);
                    } else {
                      setCompleted(true);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-surface border border-surface-raised rounded text-xs text-stone-300 hover:border-gold hover:text-gold transition-colors duration-200 cursor-pointer"
                >
                  <span className="text-gold font-mono">{i + 1}</span> {pos}
                </button>
              ))}
              <PositionKeyListener onSelect={(pos) => {
                const snap = snapshot();
                applyField(currentField, pos);
                setApplied([...applied, { field: currentField, value: pos, ...snap }]);
                setError(null);
                setInput("");
                if (fieldIdx < fields.length - 1) {
                  setFieldIdx(fieldIdx + 1);
                } else {
                  setCompleted(true);
                }
              }} onSkip={() => {
                setApplied([...applied, { field: currentField, value: "", ...snapshot() }]);
                setError(null);
                setInput("");
                if (fieldIdx < fields.length - 1) setFieldIdx(fieldIdx + 1);
                else setCompleted(true);
              }} />
              <button
                onClick={() => {
                  setApplied([...applied, { field: currentField, value: "", ...snapshot() }]);
                  setError(null);
                  setInput("");
                  if (fieldIdx < fields.length - 1) setFieldIdx(fieldIdx + 1);
                  else setCompleted(true);
                }}
                className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-300 cursor-pointer"
              >
                Skip
              </button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder={
                  getCarryForward(currentField)
                    ? `${currentField.placeholder} (Enter for ${getCarryForward(currentField)})`
                    : currentField.placeholder
                }
                className="flex-1 bg-surface border border-surface-raised rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
                autoFocus
              />
              <button
                onClick={() => advance()}
                className="px-3 py-2 bg-gold text-stone-900 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
              >
                {fieldIdx === fields.length - 1 ? "Done" : "Next"}
              </button>
              {!currentField.required && (
                <button
                  onClick={() => { setInput(""); setError(null); advance(""); }}
                  className="px-2 py-2 text-xs text-stone-500 hover:text-stone-300 cursor-pointer"
                >
                  Skip
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Street completed — show actions */}
      {completed && !savedToast && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">
            {STREET_LABELS[street]} entered.
          </span>
          {isLastStreet ? (
            <button
              onClick={handleSaveRound}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors duration-200 cursor-pointer"
            >
              Save Round <span className="text-xs opacity-70">(Enter)</span>
            </button>
          ) : (
            <button
              onClick={() => nextStreet()}
              className="px-4 py-2 bg-gold text-stone-900 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
            >
              Next Street <span className="text-xs opacity-70">(N)</span>
            </button>
          )}
          <button
            onClick={() => foldRound()}
            className="px-3 py-2 bg-surface-raised text-stone-300 rounded-lg text-sm hover:bg-surface-hover transition-colors duration-200 cursor-pointer"
          >
            Fold / Reset <span className="text-xs opacity-70">(R)</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-400 ml-18">{error}</p>}

      {/* Field progress dots */}
      {!completed && fields.length > 0 && (
        <div className="flex gap-1 ml-18">
          {fields.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < fieldIdx ? "bg-gold" : i === fieldIdx ? "bg-gold/50" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
