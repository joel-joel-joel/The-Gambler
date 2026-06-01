import { useState, useEffect, useCallback } from "react";
import type { OpponentData } from "../types";

const API_BASE = "/api/opponents";

export function useOpponents() {
  const [opponents, setOpponents] = useState<OpponentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpponents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(API_BASE);
      if (!resp.ok) throw new Error("Failed to fetch opponents");
      const data = await resp.json();
      setOpponents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createOpponent = useCallback(async (data: Partial<OpponentData>) => {
    const resp = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to create opponent");
    const created = await resp.json();
    setOpponents((prev) => [...prev, created]);
    return created;
  }, []);

  const updateOpponent = useCallback(async (id: number, data: Partial<OpponentData>) => {
    const resp = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to update opponent");
    const updated = await resp.json();
    setOpponents((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  }, []);

  const deleteOpponent = useCallback(async (id: number) => {
    const resp = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!resp.ok) throw new Error("Failed to delete opponent");
    setOpponents((prev) => prev.filter((o) => o.id !== id));
  }, []);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  return { opponents, isLoading, error, createOpponent, updateOpponent, deleteOpponent, fetchOpponents };
}
