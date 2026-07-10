import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const requireOnboardedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireOnboardedUser: () => requireOnboardedUserMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const getSiteForUserMock = vi.fn();
vi.mock("@/lib/db/sites", () => ({
  getSiteForUser: (siteId: string, userId: string) =>
    getSiteForUserMock(siteId, userId),
}));

const getInstallationMock = vi.fn();
vi.mock("@/lib/db/installations", () => ({
  getInstallationRecord: (id: number) => getInstallationMock(id),
}));

const refreshSnapshotMock = vi.fn();
vi.mock("@/lib/repo/snapshot", () => ({
  refreshSnapshot: (...a: unknown[]) => refreshSnapshotMock(...a),
}));

const readFileMock = vi.fn();
vi.mock("@/lib/repo/files", () => ({
  readSnapshotFile: (opts: unknown) => readFileMock(opts),
}));

const mintTokenMock = vi.fn();
vi.mock("@/lib/github/tokens", () => ({
  mintInstallationToken: (row: unknown) => mintTokenMock(row),
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, opts: unknown) => checkRateLimitMock(key, opts),
}));

import SitePage from "./page";
import { refreshSnapshotAction } from "./actions";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

const site = {
  id: "11111111-2222-3333-4444-555555555555",
  userId: "user-1",
  installationId: 42,
  repoId: 7,
  repoFullName: "owner/site",
  defaultBranch: "main",
  framework: "nextjs",
  status: "active",
};

const installation = {
  installationId: 42,
  suspendedAt: null,
  revokedAt: null,
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    siteId: site.id,
    commitSha: "a".repeat(40),
    ref: "main",
    status: "ready",
    fileCount: 2,
    skippedCount: 3,
    totalSize: 100,
    fileIndex: [
      { p: "app/page.tsx", s: 50, h: "b".repeat(40), r: "page" },
      { p: "components/Nav.tsx", s: 50, h: "c".repeat(40), r: "component" },
    ],
    refreshError: null,
    refreshFailedAt: null,
    indexedAt: new Date(),
    headCheckedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function renderPage(query: Record<string, string> = {}) {
  return SitePage({
    params: Promise.resolve({ siteId: site.id }),
    searchParams: Promise.resolve(query),
  });
}

beforeEach(() => {
  requireOnboardedUserMock.mockReset().mockResolvedValue(user);
  getSiteForUserMock.mockReset().mockResolvedValue(site);
  getInstallationMock.mockReset().mockResolvedValue(installation);
  refreshSnapshotMock.mockReset().mockResolvedValue(snapshot());
  readFileMock.mockReset().mockResolvedValue({ ok: true, text: "<b>not html</b>" });
  mintTokenMock.mockReset().mockResolvedValue({ token: "ghs_x", expiresAt: "x" });
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true });
});

afterEach(() => cleanup());

describe("site page", () => {
  it("renders the index for the owner", async () => {
    render(await renderPage());
    expect(screen.getByText("owner/site")).toBeTruthy();
    expect(screen.getByText(/2 files · 3 skipped/)).toBeTruthy();
    expect(screen.getByText("app/page.tsx")).toBeTruthy();
    expect(refreshSnapshotMock).toHaveBeenCalled();
  });

  it("is not accessible for other users' sites (ownership isolation)", async () => {
    getSiteForUserMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(refreshSnapshotMock).not.toHaveBeenCalled();
  });

  it("exposes the truncated state prominently", async () => {
    refreshSnapshotMock.mockResolvedValue(snapshot({ status: "truncated" }));
    render(await renderPage());
    expect(screen.getByText(/Partial index/)).toBeTruthy();
  });

  it("shows last-known-good index alongside a refresh failure", async () => {
    refreshSnapshotMock.mockResolvedValue(
      snapshot({ refreshError: "Could not reach GitHub", refreshFailedAt: new Date() })
    );
    render(await renderPage());
    expect(screen.getByText(/latest refresh failed/i)).toBeTruthy();
    expect(screen.getByText("app/page.tsx")).toBeTruthy(); // old index still usable
  });

  it("shows the failed state when no snapshot ever succeeded", async () => {
    refreshSnapshotMock.mockResolvedValue(
      snapshot({ status: "failed", fileIndex: [], refreshError: "Repository branch not found" })
    );
    render(await renderPage());
    expect(screen.getByText(/Repository branch not found/)).toBeTruthy();
    expect(screen.queryByText("app/page.tsx")).toBeNull();
  });

  it("renders file content as escaped text", async () => {
    render(await renderPage({ path: "app/page.tsx" }));
    expect(screen.getByText("<b>not html</b>")).toBeTruthy();
    expect(readFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "app/page.tsx", repoFullName: "owner/site" })
    );
  });

  it("shows friendly refusals for unreadable files", async () => {
    readFileMock.mockResolvedValue({ ok: false, reason: "too-large" });
    render(await renderPage({ path: "big.ts" }));
    expect(screen.getByText(/too large to view/)).toBeTruthy();
  });
});

describe("refreshSnapshotAction", () => {
  function form() {
    const fd = new FormData();
    fd.set("siteId", site.id);
    return fd;
  }

  it("forces a refresh for the owner and redirects back", async () => {
    await expect(refreshSnapshotAction(form())).rejects.toThrow(
      `REDIRECT:/sites/${site.id}`
    );
    expect(refreshSnapshotMock).toHaveBeenCalledWith(site, installation, {
      force: true,
    });
  });

  it("rejects non-owners before any work", async () => {
    getSiteForUserMock.mockResolvedValue(null);
    await expect(refreshSnapshotAction(form())).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(refreshSnapshotMock).not.toHaveBeenCalled();
  });

  it("rate limits refreshes", async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });
    await expect(refreshSnapshotAction(form())).rejects.toThrow(
      "refresh_rate_limited"
    );
    expect(refreshSnapshotMock).not.toHaveBeenCalled();
  });

  it("propagates authentication redirects", async () => {
    requireOnboardedUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(refreshSnapshotAction(form())).rejects.toThrow("REDIRECT:/login");
  });
});
