import { useMemo, useState } from "react";
import type { TestResult } from "@speedtest/engine";
import {
  formatMbps,
  formatMs,
  compareResults,
  resultsToCsv,
} from "@speedtest/engine";
import { QualityPill } from "./QualityPill.js";

interface HistoryScreenProps {
  history: TestResult[];
  onDelete: (id: string) => void;
  onClear: () => void;
}

function groupByDay(results: TestResult[]): [string, TestResult[]][] {
  const groups = new Map<string, TestResult[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  for (const r of results) {
    const d = new Date(r.timestamp).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : d;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }
  return Array.from(groups.entries());
}

export function HistoryScreen({
  history,
  onDelete,
  onClear,
}: HistoryScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const grouped = useMemo(() => groupByDay(history), [history]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  };

  const comparison = useMemo(() => {
    if (selected.length !== 2) return null;
    const a = history.find((r) => r.id === selected[0]);
    const b = history.find((r) => r.id === selected[1]);
    if (!a || !b) return null;
    const [before, after] =
      new Date(a.timestamp) <= new Date(b.timestamp) ? [a, b] : [b, a];
    return compareResults(before, after);
  }, [selected, history]);

  const exportAll = () => {
    const blob = new Blob([resultsToCsv(history)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "speedtest-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) {
    return (
      <div className="history-screen empty">
        <p>No test history yet. Run a test to start building your history.</p>
      </div>
    );
  }

  return (
    <div className="history-screen">
      <div className="history-header">
        <h1>Test History</h1>
        <div className="history-actions">
          <button className="btn btn-ghost" onClick={exportAll}>
            Export CSV
          </button>
          <button className="btn btn-ghost btn-danger" onClick={onClear}>
            Clear All
          </button>
        </div>
      </div>

      <p className="history-hint">Select up to two results to compare them.</p>

      {comparison && (
        <section className="comparison-card">
          <h2>Comparison</h2>
          <div className="comparison-grid">
            {comparison.metrics.map((m) => (
              <div key={m.label} className="comparison-row">
                <span className="comparison-label">{m.label}</span>
                <span>
                  {m.before} {m.unit} → {m.after} {m.unit}
                </span>
                <span
                  className={
                    m.improved
                      ? "comparison-delta improved"
                      : "comparison-delta declined"
                  }
                >
                  {m.deltaPercent > 0 ? "+" : ""}
                  {m.deltaPercent}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {grouped.map(([day, results]) => (
        <div key={day} className="history-group">
          <h3>{day}</h3>
          <div className="history-list">
            {results.map((r) => (
              <div
                key={r.id}
                className={
                  selected.includes(r.id)
                    ? "history-row selected"
                    : "history-row"
                }
              >
                <input
                  type="checkbox"
                  checked={selected.includes(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  aria-label={`Select result from ${new Date(r.timestamp).toLocaleString()} for comparison`}
                />
                <span className="history-time">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
                <span className="history-row-stats">
                  <span className="history-metric">
                    {formatMbps(r.download.mbps)} ↓
                  </span>
                  <span className="history-metric">
                    {formatMbps(r.upload.mbps)} ↑
                  </span>
                  <span className="history-metric">
                    {formatMs(r.latency.avgMs)}
                  </span>
                  <QualityPill rating={r.quality.overall} />
                </span>
                <button
                  className="btn-icon"
                  onClick={() => onDelete(r.id)}
                  aria-label="Delete this result"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
