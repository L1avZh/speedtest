import pc from "picocolors";
import { SpeedTestError } from "@speedtest/engine";

export function renderError(err: unknown): string {
  if (err instanceof SpeedTestError) {
    const lines = [pc.red(pc.bold(`✗ ${err.message}`))];
    if (err.hint) {
      lines.push("");
      lines.push(pc.gray("Try:"));
      for (const tip of err.hint.split(". ")) {
        const t = tip.trim().replace(/\.$/, "");
        if (t) lines.push(pc.gray(`  • ${t}`));
      }
    }
    return lines.join("\n");
  }
  const message = err instanceof Error ? err.message : String(err);
  return pc.red(pc.bold(`✗ Unexpected error: ${message}`));
}
