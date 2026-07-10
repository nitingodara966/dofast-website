import { beforeEach, describe, expect, it, vi } from "vitest";

const selectWhereMock = vi.fn();
const insertValuesMock = vi.fn();
const conflictMock = vi.fn().mockResolvedValue(undefined);
const updateReturningMock = vi.fn();
const updateWhereArgs: unknown[] = [];

vi.mock("./index", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: selectWhereMock, orderBy: vi.fn() }) }),
    insert: () => ({
      values: (values: unknown) => {
        insertValuesMock(values);
        return { onConflictDoUpdate: conflictMock };
      },
    }),
    update: () => ({
      set: () => ({
        where: (condition: unknown) => {
          updateWhereArgs.push(condition);
          return { returning: updateReturningMock };
        },
      }),
    }),
  }),
}));

import {
  createSite,
  disconnectSitesForInstallation,
  disconnectSitesForRepos,
} from "./sites";

const input = {
  userId: "user-1",
  installationId: 42,
  repoId: 7,
  repoFullName: "owner/site",
  defaultBranch: "main",
  framework: "nextjs",
};

beforeEach(() => {
  selectWhereMock.mockReset();
  insertValuesMock.mockClear();
  conflictMock.mockClear();
  updateReturningMock.mockReset().mockResolvedValue([]);
  updateWhereArgs.length = 0;
});

describe("createSite", () => {
  it("creates a new site scoped to the user", async () => {
    selectWhereMock.mockResolvedValue([]);
    await expect(createSite(input)).resolves.toBe("created");
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", repoId: 7, framework: "nextjs" })
    );
  });

  it("is idempotent for an already-active duplicate", async () => {
    selectWhereMock.mockResolvedValue([{ id: "site-1", status: "active" }]);
    await expect(createSite(input)).resolves.toBe("already-connected");
    // upsert still runs to refresh metadata, but no second row can exist
    expect(conflictMock).toHaveBeenCalled();
  });

  it("reactivates a previously disconnected site as created", async () => {
    selectWhereMock.mockResolvedValue([{ id: "site-1", status: "disconnected" }]);
    await expect(createSite(input)).resolves.toBe("created");
  });
});

describe("webhook invalidation", () => {
  it("disconnects only matching active sites and reports the count", async () => {
    updateReturningMock.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(disconnectSitesForRepos(42, [7, 8])).resolves.toBe(2);
    expect(updateWhereArgs).toHaveLength(1);
  });

  it("no-ops on an empty repo list without touching the database", async () => {
    await expect(disconnectSitesForRepos(42, [])).resolves.toBe(0);
    expect(updateWhereArgs).toHaveLength(0);
  });

  it("disconnects all active sites for an uninstalled installation", async () => {
    updateReturningMock.mockResolvedValue([{ id: "a" }]);
    await expect(disconnectSitesForInstallation(42)).resolves.toBe(1);
  });
});
