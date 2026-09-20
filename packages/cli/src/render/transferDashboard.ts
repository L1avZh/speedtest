import pc from "picocolors";
import { formatMbps } from "@speedtest/engine";
import { LiveBlock } from "./liveBlock.js";
import { progressBar } from "./box.js";

export class TransferDashboard {
  private readonly block = new LiveBlock();

  constructor(
    private readonly label: string,
    private readonly color: (s: string) => string,
  ) {}

  render(current: number, avg: number, peak: number, progress: number): void {
    const bar = progressBar(progress, 32, this.color);
    const lines = [
      `${this.color(this.label)}  ${bar}  ${pc.bold(formatMbps(current))}`,
      `  ${pc.gray("avg")} ${formatMbps(avg).padEnd(12)} ${pc.gray("peak")} ${formatMbps(peak)}`,
    ];
    this.block.update(lines);
  }

  finish(): void {
    this.block.finish();
  }
}
