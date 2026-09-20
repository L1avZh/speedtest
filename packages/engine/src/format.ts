export function formatMbps(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 10) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(2)} Mbps`;
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

export function formatPercent(p: number): string {
  return `${p.toFixed(p < 1 ? 2 : 1)}%`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function qualityLabel(rating: string): string {
  switch (rating) {
    case "excellent":
      return "Excellent";
    case "very-good":
      return "Very Good";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return rating;
  }
}
