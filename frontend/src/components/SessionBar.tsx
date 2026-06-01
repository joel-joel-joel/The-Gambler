import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";
import { useSessionStore } from "../store/sessionStore";

export function SessionBar() {
  const { activeSession, rounds, startSession, endSession, saveRound, checkActiveSession } =
    useSession();
  const isLoading = useSessionStore((s) => s.isLoading);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endResult, setEndResult] = useState<{ summary: string } | null>(null);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  async function handleEndSession() {
    const result = await endSession();
    if (result) {
      setEndResult(result);
    }
    setShowEndConfirm(false);
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {!activeSession ? (
        <button
          onClick={startSession}
          disabled={isLoading}
          className="px-3 py-1 bg-gold text-stone-900 rounded font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer disabled:opacity-50"
        >
          New Session
        </button>
      ) : (
        <>
          <span className="text-stone-400">
            Session <span className="text-gold font-mono">#{activeSession.id}</span>
            {" · "}
            <span className="font-mono">{rounds.length}</span> rounds
          </span>
          <button
            onClick={() => saveRound(null, 0)}
            className="px-2 py-1 bg-surface-raised text-stone-300 rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer text-xs"
          >
            Save Round
          </button>
          {!showEndConfirm ? (
            <button
              onClick={() => setShowEndConfirm(true)}
              className="px-2 py-1 bg-red-800 text-stone-200 rounded hover:bg-red-700 transition-colors duration-200 cursor-pointer text-xs"
            >
              End Session
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-stone-400 text-xs">End session?</span>
              <button
                onClick={handleEndSession}
                disabled={isLoading}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-2 py-1 bg-surface-raised text-stone-300 rounded text-xs cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </>
      )}
      {endResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-raised rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="text-gold font-semibold">Session Complete</h3>
            <p className="text-sm text-stone-300">{endResult.summary}</p>
            <button
              onClick={() => setEndResult(null)}
              className="px-4 py-2 bg-gold text-stone-900 rounded font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
