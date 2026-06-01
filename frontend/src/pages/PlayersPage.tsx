import { useState } from "react";
import { useOpponents } from "../hooks/useOpponents";
import type { OpponentData } from "../types";

const TENDENCY_OPTIONS = [
  "Tight", "Loose", "Aggressive", "Passive", "Calling Station",
  "Bluffer", "Nit", "LAG", "TAG", "Maniac", "Rock", "Fish", "Shark",
];

function OpponentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<OpponentData>;
  onSave: (data: Partial<OpponentData>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tendency_tags ?? []);
  const [vpip, setVpip] = useState(initial?.vpip_estimate?.toString() ?? "");
  const [pfr, setPfr] = useState(initial?.pfr_estimate?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      tendency_tags: tags,
      vpip_estimate: vpip ? parseInt(vpip) : null,
      pfr_estimate: pfr ? parseInt(pfr) : null,
      notes,
    });
  };

  return (
    <div className="bg-surface rounded-lg p-4 space-y-4 border border-surface-raised">
      <div>
        <label className="block text-xs text-stone-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
          placeholder="Player name or alias"
        />
      </div>
      <div>
        <label className="block text-xs text-stone-400 mb-1">Tendency Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {TENDENCY_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors duration-200 ${
                tags.includes(tag)
                  ? "bg-gold text-stone-900 font-semibold"
                  : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs text-stone-400 mb-1">VPIP %</label>
          <input
            value={vpip}
            onChange={(e) => setVpip(e.target.value)}
            type="number"
            min="0"
            max="100"
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="0-100"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-stone-400 mb-1">PFR %</label>
          <input
            value={pfr}
            onChange={(e) => setPfr(e.target.value)}
            type="number"
            min="0"
            max="100"
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="0-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-stone-400 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200 resize-none"
          placeholder="Free-form notes about this player..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-surface-raised text-stone-300 rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer text-sm"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function OpponentCard({
  opponent,
  onEdit,
  onDelete,
}: {
  opponent: OpponentData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-stone-200 font-semibold">{opponent.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-stone-400 hover:text-stone-200 cursor-pointer transition-colors duration-200"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      </div>
      {opponent.tendency_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {opponent.tendency_tags.map((tag) => (
            <span key={tag} className="bg-surface-raised text-stone-300 rounded px-2 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
      {(opponent.vpip_estimate !== null || opponent.pfr_estimate !== null) && (
        <div className="flex gap-4 text-xs text-stone-400 mb-2">
          {opponent.vpip_estimate !== null && (
            <span>VPIP: <span className="font-mono text-stone-200">{opponent.vpip_estimate}%</span></span>
          )}
          {opponent.pfr_estimate !== null && (
            <span>PFR: <span className="font-mono text-stone-200">{opponent.pfr_estimate}%</span></span>
          )}
        </div>
      )}
      {opponent.notes && (
        <p className="text-xs text-stone-400 mt-1 line-clamp-2">{opponent.notes}</p>
      )}
    </div>
  );
}

export function PlayersPage() {
  const { opponents, isLoading, error, createOpponent, updateOpponent, deleteOpponent } = useOpponents();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleCreate = async (data: Partial<OpponentData>) => {
    await createOpponent(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: Partial<OpponentData>) => {
    if (editingId !== null) {
      await updateOpponent(editingId, data);
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteOpponent(id);
  };

  if (isLoading) {
    return <p className="text-stone-400 text-center py-12">Loading opponents...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-center py-12">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-stone-200">Opponent Profiles</h2>
        {!showForm && editingId === null && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer text-sm"
          >
            Add Player
          </button>
        )}
      </div>

      {showForm && (
        <OpponentForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {opponents.length === 0 && !showForm && (
        <p className="text-stone-500 text-center py-8">No opponents tracked yet. Add your first player above.</p>
      )}

      <div className="grid gap-3">
        {opponents.map((opp) =>
          editingId === opp.id ? (
            <OpponentForm
              key={opp.id}
              initial={opp}
              onSave={handleUpdate}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <OpponentCard
              key={opp.id}
              opponent={opp}
              onEdit={() => setEditingId(opp.id)}
              onDelete={() => handleDelete(opp.id)}
            />
          )
        )}
      </div>
    </div>
  );
}
