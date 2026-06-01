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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface border border-surface-raised rounded-lg px-4 py-2 flex items-center gap-3 shadow-glow z-50">
      <span className="text-sm text-stone-300">Board updated by AI</span>
      <button
        onClick={undo}
        className="px-3 py-1 bg-gold text-stone-900 text-sm font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
      >
        Undo (<span className="font-mono">{timeLeft}s</span>)
      </button>
    </div>
  );
}
