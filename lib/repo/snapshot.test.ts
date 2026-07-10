import { beforeEach, describe, expect, it, vi } from "vitest";

const mintTokenMock = vi.fn();
vi.mock("../github/tokens", () => ({
  mintInstallationToken: (row: unknown) => mintTokenMock(row),
}));

const headShaMock = vi.fn();
const treeMock = vi.fn();
vi.mock("../github/inspect", () => ({
  getBranchHeadSha: (...a: unknown[]) => headShaMock(...a),
  getRepoTree: (...a: unknown[]) => treeMock(...a),
}));

const getSnapshotMock = vi.fn();
const upsertMock = vi.fn();
const recordFailureMock = vi.fn();
const touchMock = vi.fn();
vi.mock("../db/snapshots", () => ({
  getSnapshotForSite: (id: string) => getSnapshotMock(id),
  upsertSnapshotSuccess: (input: unknown) => upsertMock(input),
  recordSnapshotFailure: (...a: unknown[]) => recordFailureMock(...a),
  touchSnapshotHeadChecked: (id: string) => touchMock(id),
}));

import { refreshSnapshot, SNAPSHOT_TTL_MS } from "./snapshot";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const site = { id: "site-1", repoFullName: "owner/repo", defaultBranch: "main" };
const installation = { installationId: 42, suspendedAt: null, revokedAt: null };

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    siteId: "site-1",
    commitSha: SHA_A,
    ref: "main",
    status: "ready",
    fileCount: 1,
    skippedCount: 0,
    totalSize: 10,
    fileIndex: [{ p: "app/page.tsx", s: 10, h: "c".repeat(40), r: "page" }],
    refreshError: null,
    refreshFailedAt: null,
    indexedAt: new Date(Date.now() - 60_000),
    headCheckedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mintTokenMock.mockReset().mockResolvedValue({ token: "ghs_x", expiresAt: "x" });
  headShaMock.mockReset().mockResolvedValue(SHA_B);
  treeMock.mockReset().mockResolvedValue({
    truncated: false,
    entries: [
      { path: "app/page.tsx", mode: "100644", type: "blob", sha: "c".repeat(40), size: 10 },
    ],
  });
  getSnapshotMock.mockReset().mockResolvedValue(null);
  upsertMock.mockReset().mockResolvedValue(undefined);
  recordFailureMock.mockReset().mockResolvedValue(undefined);
  touchMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("refreshSnapshot", () => {
  it("builds and stores a ready snapshot for a new site", async () => {
    await refreshSnapshot(site, installation);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "site-1",
        commitSha: SHA_B,
        status: "ready",
        fileCount: 1,
      })
    );
    const upserted = upsertMock.mock.calls[0][0] as { indexedAt: Date };
    expect(upserted.indexedAt).toBeInstanceOf(Date);
  });

  it("returns a fresh snapshot without any GitHub calls (TTL)", async () => {
    getSnapshotMock.mockResolvedValue(snapshotRow());
    const result = await refreshSnapshot(site, installation);
    expect(result?.commitSha).toBe(SHA_A);
    expect(mintTokenMock).not.toHaveBeenCalled();
    expect(headShaMock).not.toHaveBeenCalled();
  });

  it("re-checks a stale snapshot but only touches it when the head is unchanged", async () => {
    getSnapshotMock.mockResolvedValue(
      snapshotRow({ headCheckedAt: new Date(Date.now() - SNAPSHOT_TTL_MS - 1000) })
    );
    headShaMock.mockResolvedValue(SHA_A); // unchanged
    await refreshSnapshot(site, installation);
    expect(touchMock).toHaveBeenCalledWith("site-1");
    expect(treeMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rebuilds when the head moved", async () => {
    getSnapshotMock.mockResolvedValue(
      snapshotRow({ headCheckedAt: new Date(Date.now() - SNAPSHOT_TTL_MS - 1000) })
    );
    headShaMock.mockResolvedValue(SHA_B);
    await refreshSnapshot(site, installation);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ commitSha: SHA_B })
    );
  });

  it("marks truncated snapshots from GitHub's truncated flag", async () => {
    treeMock.mockResolvedValue({ truncated: true, entries: [] });
    await refreshSnapshot(site, installation, { force: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "truncated" })
    );
  });

  it("records failure without overwriting the existing snapshot when GitHub is down", async () => {
    getSnapshotMock.mockResolvedValue(
      snapshotRow({ headCheckedAt: new Date(Date.now() - SNAPSHOT_TTL_MS - 1000) })
    );
    treeMock.mockRejectedValue(new Error("boom"));
    headShaMock.mockResolvedValue(SHA_B);
    await refreshSnapshot(site, installation);
    expect(recordFailureMock).toHaveBeenCalledWith(
      "site-1",
      "main",
      "Could not reach GitHub"
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("records failure when the token cannot be minted, and never throws", async () => {
    mintTokenMock.mockRejectedValue(new Error("suspended"));
    await expect(
      refreshSnapshot(site, installation, { force: true })
    ).resolves.not.toBeUndefined();
    expect(recordFailureMock).toHaveBeenCalledWith(
      "site-1",
      "main",
      "GitHub connection is unavailable"
    );
  });

  it("records failure for a missing branch", async () => {
    headShaMock.mockResolvedValue(null);
    await refreshSnapshot(site, installation, { force: true });
    expect(recordFailureMock).toHaveBeenCalledWith(
      "site-1",
      "main",
      "Repository branch not found"
    );
  });

  it("deduplicates concurrent builds for the same site", async () => {
    let resolveHead: (sha: string) => void;
    headShaMock.mockImplementation(
      () => new Promise((resolve) => (resolveHead = resolve))
    );
    const p1 = refreshSnapshot(site, installation, { force: true });
    const p2 = refreshSnapshot(site, installation, { force: true });
    await vi.waitFor(() => expect(headShaMock).toHaveBeenCalled());
    resolveHead!(SHA_B);
    await Promise.all([p1, p2]);
    expect(headShaMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
