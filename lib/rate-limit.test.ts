import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimiter } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip-1", { limit: 5 }).allowed).toBe(true);
    }
  });

  it("blocks requests over the limit with a retry hint", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("ip-1", { limit: 5 });
    const result = checkRateLimit("ip-1", { limit: 5 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("ip-1", { limit: 5 });
    expect(checkRateLimit("ip-2", { limit: 5 }).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("ip-1", { limit: 5, windowMs: 60_000 });
    expect(checkRateLimit("ip-1", { limit: 5, windowMs: 60_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit("ip-1", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
