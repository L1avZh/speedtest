import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type SettingsPatch,
} from "@speedtest/engine";
import { api } from "../api.js";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        /* fall back to defaults, e.g. if the API isn't reachable yet */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: SettingsPatch) => {
    const next = await api.updateSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    const next = await api.resetSettings();
    setSettings(next);
    return next;
  }, []);

  return { settings, loaded, update, reset };
}
