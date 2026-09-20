import { useEffect, useState } from "react";
import { useSettings } from "./hooks/useSettings.js";
import { useHistory } from "./hooks/useHistory.js";
import { useTestRunner } from "./hooks/useTestRunner.js";
import { Nav, type View } from "./components/Nav.js";
import { TestScreen } from "./components/TestScreen.js";
import { ResultsScreen } from "./components/ResultsScreen.js";
import { HistoryScreen } from "./components/HistoryScreen.js";
import { SettingsScreen } from "./components/SettingsScreen.js";
import { api } from "./api.js";
import type { TestResult } from "@speedtest/engine";

export function App() {
  const { settings, update, reset } = useSettings();
  const { history, refresh, remove, clear } = useHistory();
  const runner = useTestRunner(settings);
  const [view, setView] = useState<View>("home");
  const [result, setResult] = useState<TestResult | null>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMeta()
      .then((meta) => setDataDir(meta.dataDir))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (isDark: boolean) => {
      root.setAttribute("data-theme", isDark ? "dark" : "light");
    };
    if (settings.general.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const listener = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    applyDark(settings.general.theme === "dark");
    return undefined;
  }, [settings.general.theme]);

  const handleStart = async () => {
    setView("home");
    const res = await runner.start();
    if (res) {
      setResult(res);
      if (settings.privacy.localHistoryEnabled) {
        api
          .saveResult(res)
          .then(() => refresh())
          .catch(() => {});
      }
    }
  };

  return (
    <>
      <Nav
        view={view}
        onNavigate={setView}
        theme={settings.general.theme}
        onThemeChange={(theme) => update({ general: { theme } })}
        hasResult={Boolean(result)}
      />
      <main className="app-main">
        {view === "home" && (
          <TestScreen
            state={runner.state}
            lastResult={result ?? history[0] ?? null}
            downloadSamples={runner.downloadSamples.current}
            uploadSamples={runner.uploadSamples.current}
            sampleTick={runner.sampleTick}
            downloadDurationMs={settings.testing.downloadDurationMs}
            uploadDurationMs={settings.testing.uploadDurationMs}
            onStart={handleStart}
            onCancel={runner.cancel}
            onViewResults={() => setView("results")}
          />
        )}
        {view === "results" && (
          <ResultsScreen result={result} onRunAgain={handleStart} />
        )}
        {view === "history" && (
          <HistoryScreen history={history} onDelete={remove} onClear={clear} />
        )}
        {view === "settings" && (
          <SettingsScreen
            settings={settings}
            dataDir={dataDir}
            onUpdate={update}
            onReset={reset}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>
          Real measurements only · No telemetry · Data stored locally at{" "}
          {dataDir ?? "~/.speedtest"}
        </span>
      </footer>
    </>
  );
}
