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

const listInstallationsMock = vi.fn();
vi.mock("@/lib/db/installations", () => ({
  listInstallationsForUser: (userId: string) => listInstallationsMock(userId),
}));

const listSitesMock = vi.fn();
const createSiteMock = vi.fn();
vi.mock("@/lib/db/sites", () => ({
  listSitesForUser: (userId: string) => listSitesMock(userId),
  createSite: (input: unknown) => createSiteMock(input),
}));

const auditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/audit", () => ({
  writeAudit: (entry: unknown) => auditMock(entry),
}));

const mintTokenMock = vi.fn();
vi.mock("@/lib/github/tokens", () => ({
  mintInstallationToken: (row: unknown) => mintTokenMock(row),
}));

const listReposMock = vi.fn();
const getRepoMock = vi.fn();
const fetchPkgMock = vi.fn();
vi.mock("@/lib/github/repos", () => ({
  listInstallationRepositories: (token: string) => listReposMock(token),
  getInstallationRepository: (token: string, id: number) => getRepoMock(token, id),
  fetchRepoPackageJson: (token: string, name: string) => fetchPkgMock(token, name),
}));

import RepositoriesPage from "./page";
import { selectRepository } from "./actions";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

const installation = {
  id: "row-1",
  userId: "user-1",
  installationId: 42,
  accountLogin: "nitin",
  accountType: "User",
  repositorySelection: "selected",
  permissions: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  suspendedAt: null,
  revokedAt: null,
};

const repoSummary = {
  id: 7,
  fullName: "owner/site",
  private: true,
  defaultBranch: "main",
  archived: false,
};

function selectForm(repoId: string) {
  const fd = new FormData();
  fd.set("repoId", repoId);
  return fd;
}

beforeEach(() => {
  requireOnboardedUserMock.mockReset().mockResolvedValue(user);
  listInstallationsMock.mockReset().mockResolvedValue([installation]);
  listSitesMock.mockReset().mockResolvedValue([]);
  createSiteMock.mockReset().mockResolvedValue("created");
  mintTokenMock.mockReset().mockResolvedValue({ token: "ghs_token", expiresAt: "x" });
  listReposMock.mockReset().mockResolvedValue([repoSummary]);
  getRepoMock.mockReset().mockResolvedValue(repoSummary);
  fetchPkgMock
    .mockReset()
    .mockResolvedValue(JSON.stringify({ dependencies: { next: "16.0.0" } }));
  auditMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("repositories page", () => {
  it("lists installation repositories with a connect action", async () => {
    render(await RepositoriesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("owner/site")).toBeTruthy();
    expect(screen.getByText("private")).toBeTruthy();
    expect(screen.getByText("Connect")).toBeTruthy();
    expect(listReposMock).toHaveBeenCalledWith("ghs_token");
  });

  it("marks already-connected repositories", async () => {
    listSitesMock.mockResolvedValue([
      { id: "site-1", repoId: 7, status: "active" },
    ]);
    render(await RepositoriesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByText("Connect")).toBeNull();
  });

  it("redirects to the dashboard when GitHub is not connected", async () => {
    listInstallationsMock.mockResolvedValue([]);
    await expect(
      RepositoriesPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("shows a safe failure message when GitHub is unreachable", async () => {
    listReposMock.mockRejectedValue(new Error("boom ECONNREFUSED 10.0.0.1"));
    render(await RepositoriesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/couldn't load your repositories/)).toBeTruthy();
    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
  });
});

describe("selectRepository action", () => {
  it("validates access via the installation token and creates a user-scoped site", async () => {
    await expect(selectRepository(selectForm("7"))).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(getRepoMock).toHaveBeenCalledWith("ghs_token", 7);
    expect(createSiteMock).toHaveBeenCalledWith({
      userId: "user-1",
      installationId: 42,
      repoId: 7,
      repoFullName: "owner/site", // from GitHub, not the form
      defaultBranch: "main",
      framework: "nextjs",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "site.connected" })
    );
  });

  it("rejects malformed repo ids before any GitHub call", async () => {
    for (const bad of ["abc", "-2", "", "1.5"]) {
      await expect(selectRepository(selectForm(bad))).rejects.toThrow(
        "REDIRECT:/repositories?error=invalid_repository"
      );
    }
    expect(getRepoMock).not.toHaveBeenCalled();
    expect(createSiteMock).not.toHaveBeenCalled();
  });

  it("rejects repositories outside the user's installation grant", async () => {
    getRepoMock.mockResolvedValue(null);
    await expect(selectRepository(selectForm("999"))).rejects.toThrow(
      "REDIRECT:/repositories?error=repository_unavailable"
    );
    expect(createSiteMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported (non-Next.js/React) repositories", async () => {
    fetchPkgMock.mockResolvedValue(JSON.stringify({ dependencies: { vue: "3" } }));
    await expect(selectRepository(selectForm("7"))).rejects.toThrow(
      "REDIRECT:/repositories?error=unsupported_repository"
    );
    expect(createSiteMock).not.toHaveBeenCalled();
  });

  it("treats duplicates as a friendly notice", async () => {
    createSiteMock.mockResolvedValue("already-connected");
    await expect(selectRepository(selectForm("7"))).rejects.toThrow(
      "REDIRECT:/dashboard?notice=already_connected"
    );
  });

  it("fails safely when no active installation exists (user isolation)", async () => {
    listInstallationsMock.mockResolvedValue([
      { ...installation, revokedAt: new Date() },
    ]);
    await expect(selectRepository(selectForm("7"))).rejects.toThrow(
      "REDIRECT:/dashboard?error=github_setup_failed"
    );
    expect(mintTokenMock).not.toHaveBeenCalled();
  });

  it("propagates authentication redirects", async () => {
    requireOnboardedUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(selectRepository(selectForm("7"))).rejects.toThrow(
      "REDIRECT:/login"
    );
  });
});
