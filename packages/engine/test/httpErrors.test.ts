import { describe, expect, it } from "vitest";
import { throwForHttpStatus } from "../src/httpErrors.js";
import { SpeedTestError } from "../src/types.js";

describe("throwForHttpStatus", () => {
  it("classifies 429 as RATE_LIMITED with a specific message", () => {
    try {
      throwForHttpStatus(429, "speed.cloudflare.com");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SpeedTestError);
      expect((err as SpeedTestError).code).toBe("RATE_LIMITED");
      expect((err as SpeedTestError).message).toContain("rate-limiting");
    }
  });

  it("classifies 5xx as SERVER_ERROR", () => {
    try {
      throwForHttpStatus(503, "speed.cloudflare.com");
      expect.unreachable();
    } catch (err) {
      expect((err as SpeedTestError).code).toBe("SERVER_ERROR");
    }
  });

  it("classifies other non-OK statuses as HTTP_ERROR", () => {
    try {
      throwForHttpStatus(404, "speed.cloudflare.com");
      expect.unreachable();
    } catch (err) {
      expect((err as SpeedTestError).code).toBe("HTTP_ERROR");
    }
  });
});
