import { useCallback, useEffect, useState } from "react";
import type { TestResult } from "@speedtest/engine";
import { api } from "../api.js";

export function useHistory() {
  const [history, setHistory] = useState<TestResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const results = await api.getHistory();
      setHistory(results);
    } catch {
      /* API unreachable; keep whatever we have */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const next = await api.deleteResult(id);
    setHistory(next);
  }, []);

  const clear = useCallback(async () => {
    await api.clearHistory();
    setHistory([]);
  }, []);

  return { history, loaded, refresh, remove, clear };
}
