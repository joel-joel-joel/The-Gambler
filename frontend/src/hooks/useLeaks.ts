import { useState, useEffect, useCallback } from "react";
import type { LeakData } from "../types";

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/leaks");
      if (!resp.ok) throw new Error("Failed to fetch leaks");
      const data = await resp.json();
      setLeaks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createLeak = useCallback(async (data: Partial<LeakData>) => {
    const resp = await fetch("/api/leaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to create leak");
    const created = await resp.json();
    setLeaks((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateLeak = useCallback(async (id: number, data: Partial<LeakData>) => {
    const resp = await fetch(`/api/leaks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to update leak");
    const updated = await resp.json();
    setLeaks((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const deleteLeak = useCallback(async (id: number) => {
    const resp = await fetch(`/api/leaks/${id}`, { method: "DELETE" });
    if (!resp.ok) throw new Error("Failed to delete leak");
    setLeaks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  useEffect(() => {
    fetchLeaks();
  }, [fetchLeaks]);

  return { leaks, isLoading, error, createLeak, updateLeak, deleteLeak, fetchLeaks };
}
