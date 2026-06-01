import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

export function UndoBanner() {
  const { undoSnapshot, undo, clearUndo } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!undoSnapshot) {
      setTimeLeft(10);
      return;
    }

    setTimeLeft(10);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearUndo();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [undoSnapshot, clearUndo]);

  if (!undoSnapshot) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-3 shadow-xl z-50">
      <span className="text-sm text-gray-300">Board updated by AI</span>
      <button
        onClick={undo}
        className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-500"
      >
        Undo ({timeLeft}s)
      </button>
    </div>
  );
}
