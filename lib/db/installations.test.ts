import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const selectWhereMock = vi.fn();
const updateWhereMock = vi.fn();

vi.mock("./index", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: insertReturningMock }),
      }),
    }),
    select: () => ({
      from: () => ({ where: selectWhereMock }),
    }),
    update: () => ({
      set: () => ({
        where: (condition: unknown) => {
          void condition;
          return { returning: updateWhereMock };
        },
      }),
    }),
  }),
}));

import { claimInstallation, markInstallationRevoked } from "./installations";

const claimInput = {
  userId: "user-1",
  installationId: 42,
  accountLogin: "nitin",
  accountType: "User",
  repositorySelection: "selected",
  permissions: { contents: "read" },
  suspendedAt: null,
};

beforeEach(() => {
  insertReturningMock.mockReset();
  selectWhereMock.mockReset();
  updateWhereMock.mockReset().mockResolvedValue([{ id: "row-1" }]);
});

describe("claimInstallation", () => {
  it("claims when the insert wins", async () => {
    insertReturningMock.mockResolvedValue([{ id: "row-1" }]);
    await expect(claimInstallation(claimInput)).resolves.toBe("claimed");
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it("is idempotent when the same user already owns the installation", async () => {
    insertReturningMock.mockResolvedValue([]);
    selectWhereMock.mockResolvedValue([{ id: "row-1", userId: "user-1" }]);
    await expect(claimInstallation(claimInput)).resolves.toBe("already-owned");
  });

  it("rejects when another user owns the installation (conflict path)", async () => {
    insertReturningMock.mockResolvedValue([]);
    selectWhereMock.mockResolvedValue([{ id: "row-1", userId: "user-2" }]);
    await expect(claimInstallation(claimInput)).resolves.toBe("owned-by-other");
    expect(updateWhereMock).not.toHaveBeenCalled();
  });

  it("treats a vanished row safely as owned-by-other", async () => {
    insertReturningMock.mockResolvedValue([]);
    selectWhereMock.mockResolvedValue([]);
    await expect(claimInstallation(claimInput)).resolves.toBe("owned-by-other");
  });
});

describe("markInstallationRevoked", () => {
  it("returns true when a live row was revoked", async () => {
    updateWhereMock.mockResolvedValue([{ id: "row-1" }]);
    await expect(markInstallationRevoked(42)).resolves.toBe(true);
  });

  it("returns false for unknown installations", async () => {
    updateWhereMock.mockResolvedValue([]);
    await expect(markInstallationRevoked(999)).resolves.toBe(false);
  });
});
