import { useEffect } from "react";
import type { TestResult } from "@speedtest/engine";
import { formatMbps, formatMs, formatPercent } from "@speedtest/engine";
import type { TestRunnerState, GraphPoint } from "../hooks/useTestRunner.js";
import { Dial } from "./Dial.js";
import { SpeedGraph } from "./SpeedGraph.js";

const PHASE_LABEL: Record<string, string> = {
  idle: "",
  "checking-connectivity": "Connecting…",
  "selecting-server": "Finding server…",
  "testing-latency": "Testing latency…",
  "testing-download": "Testing download…",
  "testing-upload": "Testing upload…",
  analyzing: "Analyzing connection…",
  complete: "Complete",
  error: "Something went wrong",
};

interface TestScreenProps {
  state: TestRunnerState;
  lastResult: TestResult | null;
  downloadSamples: GraphPoint[];
  uploadSamples: GraphPoint[];
  sampleTick: number;
  downloadDurationMs: number;
  uploadDurationMs: number;
  onStart: () => void;
  onCancel: () => void;
  onViewResults: () => void;
}

export function TestScreen({
  state,
  lastResult,
  downloadSamples,
  uploadSamples,
  sampleTick,
  downloadDurationMs,
  uploadDurationMs,
  onStart,
  onCancel,
  onViewResults,
}: TestScreenProps) {
  const running =
    state.phase !== "idle" &&
    state.phase !== "complete" &&
    state.phase !== "error";

  useEffect(() => {
    if (state.phase === "complete") onViewResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onViewResults is a fresh arrow fn each parent render; this should only fire on a phase transition
  }, [state.phase]);

  if (state.phase === "error") {
    return (
      <div className="test-screen">
        <div className="error-card" role="alert">
          <h2>{state.error?.message ?? "Test failed"}</h2>
          {state.error?.hint && <p>{state.error.hint}</p>}
          <button className="btn btn-primary" onClick={onStart}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="test-screen idle">
        <p className="eyebrow">INTERNET SPEED</p>
        <Dial
          value={lastResult?.download.mbps ?? 0}
          maxScale={1000}
          unit="Mbps"
          label="↓ Download"
          color="var(--accent-1)"
          size={280}
        />
        <button className="btn btn-run" onClick={onStart}>
          Run Test
        </button>
        <div className="mini-stats">
          <div>
            <span className="mini-stat-label">Ping</span>
            <span className="mini-stat-value">
              {lastResult ? formatMs(lastResult.latency.avgMs) : "—"}
            </span>
          </div>
          <div>
            <span className="mini-stat-label">Jitter</span>
            <span className="mini-stat-value">
              {lastResult ? formatMs(lastResult.latency.jitterMs) : "—"}
            </span>
          </div>
          <div>
            <span className="mini-stat-label">Loss</span>
            <span className="mini-stat-value">
              {lastResult ? formatPercent(lastResult.latency.lossPercent) : "—"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isDownload = state.phase === "testing-download";
  const isUpload = state.phase === "testing-upload";
  const currentMbps = state.live?.currentMbps ?? 0;

  return (
    <div className="test-screen running">
      <p className="phase-label" aria-live="polite">
        {PHASE_LABEL[state.phase]}
      </p>

      {(isDownload || isUpload) && (
        <>
          <Dial
            value={currentMbps}
            maxScale={1000}
            unit="Mbps"
            label={isDownload ? "↓ Download" : "↑ Upload"}
            color={isDownload ? "var(--accent-1)" : "var(--accent-2)"}
            size={240}
          />
          <div className="live-stats">
            <div>
              <span className="mini-stat-label">Avg</span>
              <span className="mini-stat-value">
                {formatMbps(state.live?.avgMbps ?? 0)}
              </span>
            </div>
            <div>
              <span className="mini-stat-label">Peak</span>
              <span className="mini-stat-value">
                {formatMbps(state.live?.peakMbps ?? 0)}
              </span>
            </div>
            <div>
              <span className="mini-stat-label">Elapsed</span>
              <span className="mini-stat-value">
                {((state.live?.elapsedMs ?? 0) / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
          <SpeedGraph
            samples={isDownload ? downloadSamples : uploadSamples}
            sampleTick={sampleTick}
            color={isDownload ? "var(--accent-1)" : "var(--accent-2)"}
            durationMs={isDownload ? downloadDurationMs : uploadDurationMs}
            label={isDownload ? "Download" : "Upload"}
          />
        </>
      )}

      {!isDownload && !isUpload && (
        <div className="spinner-status">
          <div className="spinner" aria-hidden="true" />
          {state.latency && (
            <p className="phase-detail">
              Ping {formatMs(state.latency.avgMs)} · Jitter{" "}
              {formatMs(state.latency.jitterMs)}
            </p>
          )}
        </div>
      )}

      <button className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
