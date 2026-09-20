import { useCallback, useRef, useState } from "react";
import {
  runSpeedTest,
  SpeedTestError,
  type AppSettings,
  type LatencyResult,
  type ProgressEvent,
  type TestPhase,
  type TestResult,
} from "@speedtest/engine";

export interface GraphPoint {
  t: number;
  mbps: number;
}

export interface LiveState {
  currentMbps: number;
  avgMbps: number;
  peakMbps: number;
  elapsedMs: number;
  bytesTransferred: number;
}

export interface TestRunnerState {
  phase: TestPhase;
  message: string;
  progress: number;
  live: LiveState | null;
  latency: LatencyResult | null;
  result: TestResult | null;
  error: SpeedTestError | null;
}

const IDLE_STATE: TestRunnerState = {
  phase: "idle",
  message: "",
  progress: 0,
  live: null,
  latency: null,
  result: null,
  error: null,
};

/**
 * Drives a real test run using @speedtest/engine directly in the browser
 * (the same package the CLI imports in Node) against the real client
 * network path. Per-sample throughput points are pushed into refs rather
 * than React state so the live graph can redraw on every sample (up to
 * ~10/sec) without forcing a full component re-render tree; only the
 * headline numbers go through React state, and at a throttled rate.
 */
export function useTestRunner(settings: AppSettings) {
  const [state, setState] = useState<TestRunnerState>(IDLE_STATE);
  const downloadSamples = useRef<GraphPoint[]>([]);
  const uploadSamples = useRef<GraphPoint[]>([]);
  const [sampleTick, setSampleTick] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const lastUiUpdate = useRef(0);

  const reset = useCallback(() => {
    downloadSamples.current = [];
    uploadSamples.current = [];
    setSampleTick((t) => t + 1);
    setState(IDLE_STATE);
  }, []);

  const start = useCallback(async () => {
    downloadSamples.current = [];
    uploadSamples.current = [];
    setSampleTick((t) => t + 1);
    setState({
      ...IDLE_STATE,
      phase: "checking-connectivity",
      message: "Starting…",
    });

    const controller = new AbortController();
    controllerRef.current = controller;

    const onProgress = (event: ProgressEvent) => {
      if (event.phase === "testing-download" && event.live) {
        downloadSamples.current.push({
          t: event.live.elapsedMs,
          mbps: event.live.currentMbps,
        });
      }
      if (event.phase === "testing-upload" && event.live) {
        uploadSamples.current.push({
          t: event.live.elapsedMs,
          mbps: event.live.currentMbps,
        });
      }

      const now = performance.now();
      const isTerminalForPhase = Boolean(event.server || event.latency);
      if (!isTerminalForPhase && now - lastUiUpdate.current < 80) {
        // Throttle React state updates to ~12/sec during streaming phases;
        // the graph itself is redrawn separately from the refs above.
        return;
      }
      lastUiUpdate.current = now;

      setState((prev) => ({
        ...prev,
        phase: event.phase,
        message: event.message,
        progress: event.progress ?? prev.progress,
        live: event.live ?? prev.live,
        latency: event.latency ?? prev.latency,
      }));
      if (
        event.phase === "testing-download" ||
        event.phase === "testing-upload"
      ) {
        setSampleTick((t) => t + 1);
      }
    };

    try {
      const result = await runSpeedTest({
        enableDownload: true,
        enableUpload: true,
        downloadDurationMs: settings.testing.downloadDurationMs,
        uploadDurationMs: settings.testing.uploadDurationMs,
        downloadConnections: settings.testing.downloadConnections,
        uploadConnections: settings.testing.uploadConnections,
        latencySamples: settings.testing.latencySamples,
        timeoutMs: settings.testing.timeoutMs,
        serverId:
          settings.testing.serverSelection === "manual"
            ? settings.testing.manualServerId
            : undefined,
        customServers: settings.testing.customServers,
        networkInfoLookup: settings.privacy.networkInfoLookup,
        signal: controller.signal,
        onProgress,
      });
      setState((prev) => ({
        ...prev,
        phase: "complete",
        message: "Test complete",
        result,
      }));
      return result;
    } catch (err) {
      const error =
        err instanceof SpeedTestError
          ? err
          : new SpeedTestError(
              "UNKNOWN",
              err instanceof Error ? err.message : String(err),
            );
      setState((prev) => ({
        ...prev,
        phase: "error",
        message: error.message,
        error,
      }));
      return null;
    }
  }, [settings]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    state,
    start,
    cancel,
    reset,
    downloadSamples,
    uploadSamples,
    sampleTick,
  };
}
