import { useState } from "react";
import { usePID } from "../hooks/usePID";
import { useLeaks } from "../hooks/useLeaks";
import type { PIDVersionFull, LeakData } from "../types";

const EV_IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-red-800 text-red-200",
  improving: "bg-amber-800 text-amber-200",
  resolved: "bg-emerald-800 text-emerald-200",
};

function PIDSection() {
  const { pidMarkdown, versions, isLoading, savePID, fetchVersion } = usePID();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [viewingVersion, setViewingVersion] = useState<PIDVersionFull | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const startEdit = () => {
    setDraft(pidMarkdown);
    setEditing(true);
    setViewingVersion(null);
  };

  const handleSave = async () => {
    await savePID(draft);
    setEditing(false);
  };

  const handleViewVersion = async (historyId: number) => {
    const version = await fetchVersion(historyId);
    if (version) {
      setViewingVersion(version);
      setEditing(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-stone-200 font-semibold">Player Intelligence Document</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-stone-400 hover:text-stone-200 cursor-pointer transition-colors duration-200"
          >
            {showHistory ? "Hide History" : `History (${versions.length})`}
          </button>
          {!editing && !viewingVersion && (
            <button
              onClick={startEdit}
              className="px-2 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {showHistory && versions.length > 0 && (
        <div className="mb-3 border border-surface-raised rounded p-2 space-y-1">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleViewVersion(v.id)}
              className={`w-full text-left px-2 py-1 text-xs rounded cursor-pointer transition-colors duration-200 ${
                viewingVersion?.id === v.id
                  ? "bg-gold-700 text-stone-100"
                  : "text-stone-400 hover:bg-surface-hover hover:text-stone-200"
              }`}
            >
              v{v.version} — {v.trigger} — {v.created_at ? new Date(v.created_at).toLocaleDateString() : "unknown"}
            </button>
          ))}
        </div>
      )}

      {viewingVersion && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-stone-400">
              Viewing v{viewingVersion.version} ({viewingVersion.trigger})
            </span>
            <button
              onClick={() => setViewingVersion(null)}
              className="text-xs text-gold hover:text-gold-400 cursor-pointer transition-colors duration-200"
            >
              Back to current
            </button>
          </div>
          <pre className="bg-surface-deep rounded p-3 text-xs text-stone-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {viewingVersion.pid_markdown}
          </pre>
        </div>
      )}

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200 resize-none"
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1 bg-surface-raised text-stone-300 text-xs rounded hover:bg-surface-hover cursor-pointer transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        !viewingVersion && (
          <pre className="bg-surface-deep rounded p-3 text-xs text-stone-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {isLoading ? "Loading..." : pidMarkdown}
          </pre>
        )
      )}
    </div>
  );
}

function LeaksSection() {
  const { leaks, isLoading, createLeak, updateLeak, deleteLeak } = useLeaks();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newImpact, setNewImpact] = useState("medium");

  const sortedLeaks = [...leaks].sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, improving: 1, resolved: 2 };
    const sDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (sDiff !== 0) return sDiff;
    return (EV_IMPACT_ORDER[a.ev_impact] ?? 3) - (EV_IMPACT_ORDER[b.ev_impact] ?? 3);
  });

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    await createLeak({ description: newDesc.trim(), category: newCategory, ev_impact: newImpact });
    setNewDesc("");
    setShowAddForm(false);
  };

  const cycleStatus = async (leak: LeakData) => {
    const next: Record<string, string> = { active: "improving", improving: "resolved", resolved: "active" };
    await updateLeak(leak.id, { status: next[leak.status] ?? "active" });
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-stone-200 font-semibold">My Leaks</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-2 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
          >
            Add Leak
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-3 bg-surface-deep rounded p-3 space-y-2 border border-surface-raised">
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-surface border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="Describe the leak..."
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-surface border border-surface-raised rounded px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="general">General</option>
              <option value="preflop">Preflop</option>
              <option value="postflop">Postflop</option>
              <option value="tilt">Tilt</option>
              <option value="sizing">Sizing</option>
            </select>
            <select
              value={newImpact}
              onChange={(e) => setNewImpact(e.target.value)}
              className="bg-surface border border-surface-raised rounded px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="high">High EV</option>
              <option value="medium">Medium EV</option>
              <option value="low">Low EV</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 bg-surface-raised text-stone-300 text-xs rounded hover:bg-surface-hover cursor-pointer transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-stone-400 text-xs">Loading leaks...</p>}

      {sortedLeaks.length === 0 && !isLoading && (
        <p className="text-stone-500 text-xs text-center py-4">
          No leaks tracked yet. Play sessions to get AI-detected leaks, or add manually.
        </p>
      )}

      <div className="space-y-2">
        {sortedLeaks.map((leak) => (
          <div key={leak.id} className="flex items-start gap-3 bg-surface-deep rounded p-3">
            <button
              onClick={() => cycleStatus(leak)}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors duration-200 flex-shrink-0 ${STATUS_COLORS[leak.status] ?? "bg-surface-raised text-stone-300"}`}
              title="Click to change status"
            >
              {leak.status}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-200">{leak.description}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-stone-500">{leak.category}</span>
                <span className={`text-xs ${leak.ev_impact === "high" ? "text-red-400" : leak.ev_impact === "medium" ? "text-amber-400" : "text-stone-400"}`}>
                  {leak.ev_impact} EV
                </span>
                {leak.source === "ai" && <span className="text-xs text-gold">AI-detected</span>}
              </div>
              {leak.evidence && <p className="text-xs text-stone-500 mt-1">{leak.evidence}</p>}
            </div>
            <button
              onClick={() => deleteLeak(leak.id)}
              className="text-xs text-stone-500 hover:text-red-400 cursor-pointer transition-colors duration-200 flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyGamePage() {
  return (
    <div className="space-y-6">
      <PIDSection />
      <LeaksSection />
    </div>
  );
}
