/** Redraws a fixed block of lines in place using ANSI cursor movement. Falls back to nothing extra on non-TTY streams (caller should print a final summary instead). */
export class LiveBlock {
  private lastLineCount = 0;
  constructor(private readonly stream: NodeJS.WriteStream = process.stdout) {}

  get isInteractive(): boolean {
    return this.stream.isTTY === true;
  }

  update(lines: string[]): void {
    if (!this.isInteractive) return;
    if (this.lastLineCount > 0) {
      this.stream.write(`\x1b[${this.lastLineCount}A`);
    }
    for (const line of lines) {
      this.stream.write(`\x1b[2K${line}\n`);
    }
    this.lastLineCount = lines.length;
  }

  clear(): void {
    if (!this.isInteractive || this.lastLineCount === 0) return;
    this.stream.write(`\x1b[${this.lastLineCount}A`);
    for (let i = 0; i < this.lastLineCount; i++) {
      this.stream.write("\x1b[2K\n");
    }
    this.stream.write(`\x1b[${this.lastLineCount}A`);
    this.lastLineCount = 0;
  }

  finish(): void {
    this.lastLineCount = 0;
  }
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private frame = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly block = new LiveBlock();
  private text = "";

  start(text: string): void {
    this.text = text;
    if (!this.block.isInteractive) {
      process.stdout.write(`${text}\n`);
      return;
    }
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      this.block.update([`${SPINNER_FRAMES[this.frame]} ${this.text}`]);
    }, 80);
  }

  update(text: string): void {
    this.text = text;
    if (!this.block.isInteractive) return;
  }

  stop(finalText: string, symbol = "✓"): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.block.isInteractive) {
      this.block.update([`${symbol} ${finalText}`]);
      this.block.finish();
    } else {
      process.stdout.write(`${symbol} ${finalText}\n`);
    }
  }
}
