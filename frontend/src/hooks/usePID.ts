import { useState, useEffect, useCallback } from "react";
import type { PIDVersion, PIDVersionFull } from "../types";

export function usePID() {
  const [pidMarkdown, setPidMarkdown] = useState("");
  const [versions, setVersions] = useState<PIDVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPID = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/pid");
      if (!resp.ok) throw new Error("Failed to fetch PID");
      const data = await resp.json();
      setPidMarkdown(data.pid_markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const savePID = useCallback(async (markdown: string) => {
    const resp = await fetch("/api/pid", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid_markdown: markdown }),
    });
    if (!resp.ok) throw new Error("Failed to save PID");
    const data = await resp.json();
    setPidMarkdown(data.pid_markdown);
    await fetchVersions();
    return data;
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      const resp = await fetch("/api/pid/history");
      if (!resp.ok) return;
      const data = await resp.json();
      setVersions(data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchVersion = useCallback(async (historyId: number): Promise<PIDVersionFull | null> => {
    try {
      const resp = await fetch(`/api/pid/history/${historyId}`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchPID();
    fetchVersions();
  }, [fetchPID, fetchVersions]);

  return { pidMarkdown, versions, isLoading, error, savePID, fetchVersion, fetchPID };
}
