import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const markRevokedMock = vi.fn();
vi.mock("../db/installations", () => ({
  markInstallationRevoked: (id: number) => markRevokedMock(id),
}));
vi.mock("./app", () => ({
  githubAppHeaders: () => ({ Authorization: "Bearer test-jwt" }),
}));

import { mintInstallationToken } from "./tokens";

const active = { installationId: 42, suspendedAt: null, revokedAt: null };

describe("mintInstallationToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(
      new Response(
        JSON.stringify({ token: "ghs_testtoken", expires_at: "2026-07-08T00:00:00Z" }),
        { status: 201 }
      )
    );
    markRevokedMock.mockReset().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mints a token for an active installation", async () => {
    const result = await mintInstallationToken(active);
    expect(result).toEqual({
      token: "ghs_testtoken",
      expiresAt: "2026-07-08T00:00:00Z",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/app/installations/42/access_tokens");
    expect(init.method).toBe("POST");
  });

  it("refuses revoked installations without calling GitHub", async () => {
    await expect(
      mintInstallationToken({ ...active, revokedAt: new Date() })
    ).rejects.toThrow("disconnected");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses suspended installations without calling GitHub", async () => {
    await expect(
      mintInstallationToken({ ...active, suspendedAt: new Date() })
    ).rejects.toThrow("suspended");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the installation revoked when GitHub returns 404", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(mintInstallationToken(active)).rejects.toThrow(
      "no longer exists"
    );
    expect(markRevokedMock).toHaveBeenCalledWith(42);
  });

  it("fails safely on other GitHub errors without leaking details", async () => {
    fetchMock.mockResolvedValue(
      new Response("internal provider detail", { status: 500 })
    );
    await expect(mintInstallationToken(active)).rejects.toThrow(
      "GitHub token request failed"
    );
    expect(markRevokedMock).not.toHaveBeenCalled();
  });
});
