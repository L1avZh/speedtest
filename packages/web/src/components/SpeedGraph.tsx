import { useEffect, useRef } from "react";
import type { GraphPoint } from "../hooks/useTestRunner.js";

/** Resolves a `var(--custom-prop)` string to its computed value (falls back to the input unchanged, e.g. for a literal hex color). */
function resolveCssColor(color: string, styles: CSSStyleDeclaration): string {
  const match = /^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/.exec(color.trim());
  if (!match) return color;
  const [, propName, fallback] = match;
  const resolved = styles.getPropertyValue(propName!).trim();
  return resolved || fallback?.trim() || "#888888";
}

interface SpeedGraphProps {
  samples: GraphPoint[];
  /** Bumped by the caller each time a new sample lands. `samples` is a
   * mutated-in-place ref array, so its object reference never changes —
   * this counter is what actually triggers the redraw effect below. */
  sampleTick: number;
  color: string;
  durationMs: number;
  label: string;
}

/**
 * Imperative canvas chart: redraws directly from a mutable samples array
 * without going through React's render tree, so a fast-arriving stream of
 * real measurements (up to ~10/sec) stays smooth even on slower machines.
 * This is a live plot of the actual instantaneous throughput samples
 * produced by the engine — nothing here is synthesized or eased.
 */
export function SpeedGraph({
  samples,
  sampleTick,
  color,
  durationMs,
  label,
}: SpeedGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // A canvas drawing bug should never take down the rest of the app —
    // this graph is a nice-to-have visualization, not load-bearing state.
    try {
      drawGraph();
    } catch (err) {
      console.error("SpeedGraph failed to draw", err);
    }

    function drawGraph() {
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const styles = getComputedStyle(document.documentElement);
      const gridColor =
        styles.getPropertyValue("--border").trim() || "rgba(128,128,128,0.15)";
      const textColor =
        styles.getPropertyValue("--text-tertiary").trim() || "#888";
      // Canvas 2D color setters (and addColorStop, which THROWS rather than
      // silently ignoring bad input) don't resolve CSS custom properties —
      // `var(--accent-1)` isn't a valid canvas color. Resolve it ourselves.
      const resolvedColor = resolveCssColor(color, styles);

      const paddingLeft = 44;
      const paddingBottom = 20;
      const paddingTop = 10;
      const plotWidth = width - paddingLeft - 8;
      const plotHeight = height - paddingBottom - paddingTop;

      const maxMbps = Math.max(10, ...samples.map((s) => s.mbps)) * 1.15;
      const maxT = Math.max(durationMs, ...samples.map((s) => s.t), 1000);

      // Grid lines + y-axis labels
      ctx.strokeStyle = gridColor;
      ctx.fillStyle = textColor;
      ctx.font = "11px var(--font-sans, sans-serif)";
      ctx.lineWidth = 1;
      const gridLines = 4;
      for (let i = 0; i <= gridLines; i++) {
        const y = paddingTop + (plotHeight * i) / gridLines;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - 4, y);
        ctx.stroke();
        const value = Math.round(maxMbps * (1 - i / gridLines));
        ctx.fillText(String(value), 4, y + 4);
      }

      if (samples.length < 2) {
        ctx.fillStyle = textColor;
        ctx.fillText(
          `Waiting for ${label.toLowerCase()} data…`,
          paddingLeft + 8,
          height / 2,
        );
        return;
      }

      const x = (t: number) => paddingLeft + (t / maxT) * plotWidth;
      const y = (mbps: number) =>
        paddingTop + plotHeight - (mbps / maxMbps) * plotHeight;

      // Filled area under the curve
      ctx.beginPath();
      ctx.moveTo(x(samples[0]!.t), y(samples[0]!.mbps));
      for (const s of samples) ctx.lineTo(x(s.t), y(s.mbps));
      ctx.lineTo(x(samples[samples.length - 1]!.t), paddingTop + plotHeight);
      ctx.lineTo(x(samples[0]!.t), paddingTop + plotHeight);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(
        0,
        paddingTop,
        0,
        paddingTop + plotHeight,
      );
      gradient.addColorStop(0, `${resolvedColor}33`);
      gradient.addColorStop(1, `${resolvedColor}00`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(x(samples[0]!.t), y(samples[0]!.mbps));
      for (const s of samples) ctx.lineTo(x(s.t), y(s.mbps));
      ctx.strokeStyle = resolvedColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Current point
      const last = samples[samples.length - 1]!;
      ctx.beginPath();
      ctx.arc(x(last.t), y(last.mbps), 4, 0, Math.PI * 2);
      ctx.fillStyle = resolvedColor;
      ctx.fill();

      // X-axis seconds labels
      ctx.fillStyle = textColor;
      const seconds = Math.round(maxT / 1000);
      const step = seconds <= 5 ? 1 : Math.ceil(seconds / 5);
      for (let s = 0; s <= seconds; s += step) {
        const px = x(s * 1000);
        ctx.fillText(`${s}s`, px - 6, height - 4);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- samples is a mutated-in-place ref array; sampleTick is the real dependency (see prop doc above)
  }, [sampleTick, color, durationMs, label]);

  return (
    <div
      className="speed-graph"
      ref={containerRef}
      role="img"
      aria-label={`${label} speed over time chart`}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
