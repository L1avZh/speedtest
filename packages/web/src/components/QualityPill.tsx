import type { QualityRating } from "@speedtest/engine";
import { qualityLabel } from "@speedtest/engine";

const COLOR: Record<QualityRating, string> = {
  excellent: "var(--success)",
  "very-good": "#4ade80",
  good: "var(--warning)",
  fair: "#fb923c",
  poor: "var(--danger)",
};

export function QualityPill({ rating }: { rating: QualityRating }) {
  return (
    <span
      className="quality-pill"
      style={{ ["--pill-color" as string]: COLOR[rating] }}
    >
      {qualityLabel(rating)}
    </span>
  );
}
