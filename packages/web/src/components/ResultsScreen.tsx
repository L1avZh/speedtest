import { useState } from "react";
import type { TestResult } from "@speedtest/engine";
import {
  formatMbps,
  formatMs,
  formatPercent,
  formatDuration,
  resultToJson,
  resultToCsv,
  resultToText,
} from "@speedtest/engine";
import { QualityPill } from "./QualityPill.js";

interface ResultsScreenProps {
  result: TestResult | null;
  onRunAgain: () => void;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsScreen({ result, onRunAgain }: ResultsScreenProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="results-screen empty">
        <p>No results yet. Run a test to see your results here.</p>
        <button className="btn btn-primary" onClick={onRunAgain}>
          Run Test
        </button>
      </div>
    );
  }

  const copyResults = async () => {
    try {
      await navigator.clipboard.writeText(resultToText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable/denied — no-op, button just won't confirm */
    }
  };

  const shareResults = async () => {
    const text = resultToText(result);
    if (navigator.share) {
      try {
        await navigator.share({ title: "My SpeedTest Result", text });
        return;
      } catch {
        /* user cancelled the native share sheet — fall through to clipboard */
      }
    }
    // No backend sharing endpoint exists yet (by design — see Privacy).
    // The share affordance degrades to "copy a shareable summary" so the
    // UI never claims a capability (hosted share links) it doesn't have.
    await navigator.clipboard.writeText(text).catch(() => {});
    setShared("Copied a shareable summary to your clipboard.");
    setTimeout(() => setShared(null), 3000);
  };

  return (
    <div className="results-screen">
      <h1 className="results-title">Your Results</h1>

      <div className="results-grid">
        <div className="result-card">
          <span className="result-label">Download</span>
          <span className="result-value">
            {formatMbps(result.download.mbps)}
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">Upload</span>
          <span className="result-value">{formatMbps(result.upload.mbps)}</span>
        </div>
        <div className="result-card">
          <span className="result-label">Ping</span>
          <span className="result-value">{formatMs(result.latency.avgMs)}</span>
        </div>
        <div className="result-card">
          <span className="result-label">Jitter</span>
          <span className="result-value">
            {formatMs(result.latency.jitterMs)}
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">Packet Loss</span>
          <span className="result-value">
            {formatPercent(result.latency.lossPercent)}
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">Quality</span>
          <QualityPill rating={result.quality.overall} />
        </div>
      </div>

      <section className="results-section">
        <h2>Connection Quality</h2>
        <div className="quality-breakdown">
          <div>
            <span>Download</span>
            <QualityPill rating={result.quality.download} />
          </div>
          <div>
            <span>Upload</span>
            <QualityPill rating={result.quality.upload} />
          </div>
          <div>
            <span>Latency</span>
            <QualityPill rating={result.quality.latency} />
          </div>
          <div>
            <span>Stability</span>
            <QualityPill rating={result.quality.stability} />
          </div>
          <div>
            <span>Packet Loss</span>
            <QualityPill rating={result.quality.packetLoss} />
          </div>
        </div>
      </section>

      <section className="results-section">
        <h2>Well suited for</h2>
        <ul className="recommendation-list">
          {result.recommendations.map((rec) => (
            <li
              key={rec.id}
              className={rec.suitable ? "suitable" : "unsuitable"}
            >
              <span aria-hidden="true">{rec.suitable ? "✓" : "✗"}</span>{" "}
              {rec.label}
              <span className="recommendation-reason">{rec.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="results-section">
        <h2>Test Details</h2>
        <dl className="detail-list">
          <div>
            <dt>Server</dt>
            <dd>
              {result.server.name} ({result.server.location}
              {result.server.colo ? `, ${result.server.colo}` : ""})
            </dd>
          </div>
          {result.network.isp && (
            <div>
              <dt>ISP</dt>
              <dd>{result.network.isp}</dd>
            </div>
          )}
          <div>
            <dt>Timestamp</dt>
            <dd>{new Date(result.timestamp).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Test Duration</dt>
            <dd>{formatDuration(result.durationMs)}</dd>
          </div>
          <div>
            <dt>Methodology</dt>
            <dd>
              {result.methodology.downloadConnections} parallel connections ·{" "}
              {result.methodology.latencySamples} latency probes · HTTPS
              round-trip timing
            </dd>
          </div>
        </dl>
      </section>

      <div className="results-actions">
        <button className="btn btn-primary" onClick={onRunAgain}>
          Run Again
        </button>
        <button className="btn btn-ghost" onClick={shareResults}>
          {shared ?? "Share Results"}
        </button>
        <button className="btn btn-ghost" onClick={copyResults}>
          {copied ? "Copied!" : "Copy Results"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() =>
            downloadFile(
              `speedtest-${result.id}.json`,
              resultToJson(result),
              "application/json",
            )
          }
        >
          Export JSON
        </button>
        <button
          className="btn btn-ghost"
          onClick={() =>
            downloadFile(
              `speedtest-${result.id}.csv`,
              resultToCsv(result),
              "text/csv",
            )
          }
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
