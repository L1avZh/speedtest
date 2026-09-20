import pc from "picocolors";
import type { QualityRating } from "@speedtest/engine";

export const theme = {
  title: (s: string) => pc.bold(pc.cyan(s)),
  heading: (s: string) => pc.bold(pc.white(s)),
  dim: (s: string) => pc.dim(s),
  label: (s: string) => pc.gray(s),
  value: (s: string) => pc.bold(pc.white(s)),
  accent: (s: string) => pc.bold(pc.cyanBright(s)),
  success: (s: string) => pc.green(s),
  warn: (s: string) => pc.yellow(s),
  error: (s: string) => pc.red(s),
  bar: (s: string) => pc.cyanBright(s),
  barUpload: (s: string) => pc.magentaBright(s),
};

export function qualityColor(rating: QualityRating, text: string): string {
  switch (rating) {
    case "excellent":
      return pc.bold(pc.greenBright(text));
    case "very-good":
      return pc.bold(pc.green(text));
    case "good":
      return pc.bold(pc.yellowBright(text));
    case "fair":
      return pc.bold(pc.yellow(text));
    case "poor":
      return pc.bold(pc.red(text));
    default:
      return text;
  }
}

export const supportsColor = process.stdout.isTTY === true;
