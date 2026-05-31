import { useGameStore } from "../store/gameStore";

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
        <label className="block text-xs text-gray-400 mb-1">Pot Size</label>
        <div className="flex gap-1">
          <input
            type="number"
            value={potSize || ""}
            onChange={(e) => setPotSize(Number(e.target.value))}
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          />
          <div className="flex gap-0.5">
            {[10, 50, 100].map((inc) => (
              <button
                key={inc}
                onClick={() => setPotSize(potSize + inc)}
                className="px-1.5 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
              >
                +{inc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Bet to Call</label>
        <input
          type="number"
          value={betToCall || ""}
          onChange={(e) => setBetToCall(Number(e.target.value))}
          placeholder="0"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Players</label>
        <input
          type="number"
          min={2}
          max={10}
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Position</label>
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(position === pos ? null : pos)}
              className={`px-2 py-1 text-xs rounded ${
                position === pos
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Your Stack</label>
        <input
          type="number"
          value={yourStack ?? ""}
          onChange={(e) => setYourStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Villain Stack</label>
        <input
          type="number"
          value={villainStack ?? ""}
          onChange={(e) => setVillainStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}
