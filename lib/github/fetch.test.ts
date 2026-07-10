import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { githubFetch } from "./fetch";

const fetchMock = vi.fn();
const errorLines: string[] = [];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  errorLines.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errorLines.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("githubFetch", () => {
  it("passes through responses and attaches an abort signal", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await githubFetch("https://api.github.com/repos/owner/repo", {
      headers: { Authorization: "Bearer ghs_secret" },
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps timeouts to a safe generic error leaking neither URL nor token", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError")
    );
    await expect(
      githubFetch("https://api.github.com/repos/secret-owner/secret-repo", {
        headers: { Authorization: "Bearer ghs_secret" },
      })
    ).rejects.toThrow("GitHub API request failed");

    const logged = errorLines.join("\n");
    expect(logged).toContain("TimeoutError");
    expect(logged).not.toContain("secret-owner");
    expect(logged).not.toContain("ghs_secret");
    expect(logged).not.toContain("api.github.com");
  });

  it("maps network errors the same way", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED 1.2.3.4"));
    await expect(githubFetch("https://api.github.com/x")).rejects.toThrow(
      "GitHub API request failed"
    );
    expect(errorLines.join("\n")).not.toContain("ECONNREFUSED");
  });
});
