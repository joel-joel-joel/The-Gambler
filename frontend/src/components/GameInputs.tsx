import { useGameStore } from "../store/gameStore";
import { HelpTooltip } from "./HelpTooltip";

const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"] as const;

export function GameInputs() {
  const {
    numPlayers,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
    setNumPlayers,
    setPotSize,
    setBetToCall,
    setPosition,
    setYourStack,
    setVillainStack,
  } = useGameStore();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs text-stone-400 mb-1">Pot Size</label>
        <div className="flex gap-1">
          <input
            type="number"
            value={potSize || ""}
            onChange={(e) => setPotSize(Number(e.target.value))}
            placeholder="0"
            className="w-full bg-surface border border-surface-raised rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
          />
          <div className="flex gap-0.5">
            {[10, 50, 100].map((inc) => (
              <button
                key={inc}
                onClick={() => setPotSize(potSize + inc)}
                className="px-1.5 py-1 text-xs bg-surface-raised rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer font-mono"
              >
                +{inc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-stone-400 mb-1">Bet to Call</label>
        <input
          type="number"
          value={betToCall || ""}
          onChange={(e) => setBetToCall(Number(e.target.value))}
          placeholder="0"
          className="w-full bg-surface border border-surface-raised rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
        />
      </div>

      <div>
        <label className="block text-xs text-stone-400 mb-1">Players</label>
        <input
          type="number"
          min={2}
          max={10}
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value))}
          className="w-full bg-surface border border-surface-raised rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
        />
      </div>

      <div>
        <div className="flex items-center text-xs text-stone-400 mb-1">
          <label>Position</label>
          <HelpTooltip title="Table Positions">
            <ul className="space-y-1 text-stone-300">
              <li><span className="text-stone-100 font-semibold">UTG</span> — Under the Gun (first to act)</li>
              <li><span className="text-stone-100 font-semibold">MP</span> — Middle Position</li>
              <li><span className="text-stone-100 font-semibold">CO</span> — Cutoff (one before dealer)</li>
              <li><span className="text-stone-100 font-semibold">BTN</span> — Button/Dealer (best position)</li>
              <li><span className="text-stone-100 font-semibold">SB</span> — Small Blind</li>
              <li><span className="text-stone-100 font-semibold">BB</span> — Big Blind</li>
            </ul>
            <p className="mt-1.5 text-stone-500">Later positions have more information and are generally stronger.</p>
          </HelpTooltip>
        </div>
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(position === pos ? null : pos)}
              className={`px-2 py-1 text-xs rounded transition-colors duration-200 cursor-pointer ${
                position === pos
                  ? "bg-gold text-stone-900 font-semibold"
                  : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-stone-400 mb-1">Your Stack</label>
        <input
          type="number"
          value={yourStack ?? ""}
          onChange={(e) => setYourStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-surface border border-surface-raised rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
        />
      </div>

      <div>
        <label className="block text-xs text-stone-400 mb-1">Villain Stack</label>
        <input
          type="number"
          value={villainStack ?? ""}
          onChange={(e) => setVillainStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-surface border border-surface-raised rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-gold transition-colors duration-200"
        />
      </div>
    </div>
  );
}
