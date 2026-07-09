import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimiter } from "@/lib/rate-limit";
import { createStateToken, GITHUB_STATE_COOKIE } from "@/lib/github/state";

const getUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getUser: () => getUserMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const getInstallationMock = vi.fn();
vi.mock("@/lib/github/app", () => ({
  getInstallation: (id: number) => getInstallationMock(id),
}));

const claimMock = vi.fn();
vi.mock("@/lib/db/installations", () => ({
  claimInstallation: (input: unknown) => claimMock(input),
}));

const auditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/audit", () => ({
  writeAudit: (entry: unknown) => auditMock(entry),
}));

import { GET as installGET } from "./install/route";
import { GET as setupGET } from "./setup/route";

const sessionUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

const installationInfo = {
  id: 42,
  accountLogin: "nitin",
  accountType: "User",
  repositorySelection: "selected",
  permissions: { contents: "read", metadata: "read" },
  suspendedAt: null,
};

function stubEnvs() {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    Buffer.from(
      "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"
    ).toString("base64")
  );
  vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("GITHUB_APP_SLUG", "dofast-ai");
  vi.stubEnv("BETTER_AUTH_SECRET", "state-secret-for-tests");
}

beforeEach(() => {
  resetRateLimiter();
  stubEnvs();
  getUserMock.mockReset().mockResolvedValue(sessionUser);
  getInstallationMock.mockReset().mockResolvedValue(installationInfo);
  claimMock.mockReset().mockResolvedValue("claimed");
  auditMock.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/github/install", () => {
  const request = (ip = "203.0.113.1") =>
    new NextRequest("http://localhost:3000/api/github/install", {
      headers: { "x-forwarded-for": ip },
    });

  it("redirects unauthenticated users to /login", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(installGET(request())).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to the official install URL with signed state and secure cookie", async () => {
    const res = await installGET(request());
    expect(res.status).toBe(307);

    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(
      "https://github.com/apps/dofast-ai/installations/new"
    );
    const state = location.searchParams.get("state")!;
    expect(state).toMatch(/^\d+\.[0-9a-f]{32}\.[0-9a-f]{64}$/);

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain(`${GITHUB_STATE_COOKIE}=`);
    expect(setCookie).toContain(encodeURIComponent(state).slice(0, 20));
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/api/github");
    expect(setCookie).toContain("Max-Age=600");
  });

  it("fails safely with 500 when configuration is missing", async () => {
    vi.stubEnv("GITHUB_APP_SLUG", "");
    const res = await installGET(request());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("GITHUB_APP");
  });

  it("rate limits repeated requests", async () => {
    for (let i = 0; i < 10; i++) await installGET(request("198.51.100.9"));
    const res = await installGET(request("198.51.100.9"));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/github/setup", () => {
  function setupRequest({
    state,
    cookie,
    installationId = "42",
    ip = "203.0.113.50",
  }: {
    state?: string;
    cookie?: string;
    installationId?: string;
    ip?: string;
  }) {
    const url = new URL("http://localhost:3000/api/github/setup");
    if (state !== undefined) url.searchParams.set("state", state);
    url.searchParams.set("installation_id", installationId);
    url.searchParams.set("setup_action", "install");
    const headers: Record<string, string> = { "x-forwarded-for": ip };
    if (cookie !== undefined) {
      headers.cookie = `${GITHUB_STATE_COOKIE}=${cookie}`;
    }
    return new NextRequest(url, { headers });
  }

  function validState() {
    return createStateToken("user-1");
  }

  it("redirects unauthenticated users to /login", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(setupGET(setupRequest({}))).rejects.toThrow("REDIRECT:/login");
  });

  it("claims the installation with GitHub-verified metadata and redirects home", async () => {
    const state = validState();
    const res = await setupGET(setupRequest({ state, cookie: state }));

    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(getInstallationMock).toHaveBeenCalledWith(42);
    expect(claimMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        installationId: 42,
        accountLogin: "nitin", // from GitHub, never from the query string
        permissions: installationInfo.permissions,
      })
    );
    // state cookie cleared
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "github.installation.connected" })
    );
  });

  it("rejects when state is missing, mismatched, or for another user", async () => {
    const state = validState();

    for (const req of [
      setupRequest({ state }), // no cookie
      setupRequest({ cookie: state }), // no query state
      setupRequest({ state, cookie: createStateToken("user-1") }), // mismatch
      setupRequest({
        state: createStateToken("user-2"),
        cookie: createStateToken("user-2"),
      }), // bound to another user
    ]) {
      const res = await setupGET(req);
      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/dashboard?error=github_setup_failed"
      );
    }
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("rejects invalid installation_id values without calling GitHub", async () => {
    const state = validState();
    for (const bad of ["abc", "-1", "1e9", "9".repeat(20), ""]) {
      const res = await setupGET(
        setupRequest({ state, cookie: state, installationId: bad })
      );
      expect(res.headers.get("location")).toContain("github_setup_failed");
    }
    expect(getInstallationMock).not.toHaveBeenCalled();
  });

  it("rejects when GitHub does not know the installation", async () => {
    getInstallationMock.mockResolvedValue(null);
    const state = validState();
    const res = await setupGET(setupRequest({ state, cookie: state }));
    expect(res.headers.get("location")).toContain("github_setup_failed");
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("is idempotent for re-claims by the same owner", async () => {
    claimMock.mockResolvedValue("already-owned");
    const state = validState();
    const res = await setupGET(setupRequest({ state, cookie: state }));
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("rejects installations owned by another DoFast user with a safe error", async () => {
    claimMock.mockResolvedValue("owned-by-other");
    const state = validState();
    const res = await setupGET(setupRequest({ state, cookie: state }));
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/dashboard?error=installation_unavailable"
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "github.installation.claim_conflict" })
    );
  });
});
