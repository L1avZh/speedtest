import { SpeedTestError } from "./types.js";

/**
 * Classifies a non-OK HTTP response from a test server into a specific,
 * actionable SpeedTestError instead of a generic "network error" — this
 * matters most for 429 (rate limited), which looks identical to a dead
 * connection if you only check "did any bytes arrive?".
 */
export function throwForHttpStatus(status: number, host: string): never {
  if (status === 429) {
    throw new SpeedTestError(
      "RATE_LIMITED",
      `${host} is rate-limiting requests right now.`,
      "Wait a moment and try again, or switch to a different server in Settings.",
    );
  }
  if (status >= 500) {
    throw new SpeedTestError(
      "SERVER_ERROR",
      `${host} returned a server error (HTTP ${status}).`,
      "Try automatic server selection, or try again shortly.",
    );
  }
  throw new SpeedTestError(
    "HTTP_ERROR",
    `${host} responded with HTTP ${status}.`,
    "Try automatic server selection or a different server.",
  );
}
