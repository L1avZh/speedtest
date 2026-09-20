import pc from "picocolors";

export function headerBox(title: string, width = 50): string {
  const inner = width - 2;
  const pad = Math.max(0, inner - title.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  const top = `╭${"─".repeat(inner)}╮`;
  const mid = `│${" ".repeat(left)}${title}${" ".repeat(right)}│`;
  const bottom = `╰${"─".repeat(inner)}╯`;
  return pc.cyan([top, mid, bottom].join("\n"));
}

export function rule(width = 50): string {
  return pc.dim("─".repeat(width));
}

export function row(label: string, value: string, labelWidth = 12): string {
  return `  ${pc.gray(label.padEnd(labelWidth))} ${value}`;
}

export function progressBar(
  fraction: number,
  width = 30,
  color: (s: string) => string = (s) => s,
): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(width * clamped);
  return color("█".repeat(filled)) + pc.dim("░".repeat(width - filled));
}
