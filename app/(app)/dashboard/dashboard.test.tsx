import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const requireUserMock = vi.fn();
const requireOnboardedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
  requireOnboardedUser: () => requireOnboardedUserMock(),
}));
vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button>Sign out</button>,
}));

const listInstallationsMock = vi.fn();
vi.mock("@/lib/db/installations", () => ({
  listInstallationsForUser: (userId: string) => listInstallationsMock(userId),
}));

import AppLayout from "../layout";
import DashboardPage from "./page";

const onboardedUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

function installation(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    userId: "user-1",
    installationId: 42,
    accountLogin: "nitin",
    accountType: "User",
    repositorySelection: "selected",
    permissions: { contents: "read" },
    createdAt: new Date(),
    updatedAt: new Date(),
    suspendedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function renderDashboard(params: Record<string, string> = {}) {
  return DashboardPage({ searchParams: Promise.resolve(params) });
}

describe("protected dashboard", () => {
  beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue(onboardedUser);
    requireOnboardedUserMock.mockReset().mockResolvedValue(onboardedUser);
    listInstallationsMock.mockReset().mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("layout renders branding, user identity, and sign-out", async () => {
    render(await AppLayout({ children: <div>page-content</div> }));
    expect(screen.getByText("DoFast")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("layout never renders for unauthenticated users", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(AppLayout({ children: <div>secret</div> })).rejects.toThrow(
      "REDIRECT:/login"
    );
  });

  it("sends not-yet-onboarded users to onboarding", async () => {
    requireOnboardedUserMock.mockRejectedValue(new Error("REDIRECT:/onboarding"));
    await expect(renderDashboard()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("without an installation, shows the real Connect GitHub flow", async () => {
    render(await renderDashboard());
    expect(screen.getByText("No websites connected yet")).toBeTruthy();
    const connect = screen.getByText("Connect GitHub") as HTMLAnchorElement;
    expect(connect.getAttribute("href")).toBe("/api/github/install");
    expect(listInstallationsMock).toHaveBeenCalledWith("user-1");
  });

  it("shows connected state with the GitHub account identity", async () => {
    listInstallationsMock.mockResolvedValue([installation()]);
    render(await renderDashboard());
    expect(screen.getByText("GitHub connected")).toBeTruthy();
    expect(screen.getByText("nitin")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByText("Connect GitHub")).toBeNull();
  });

  it("shows suspended state", async () => {
    listInstallationsMock.mockResolvedValue([
      installation({ suspendedAt: new Date() }),
    ]);
    render(await renderDashboard());
    expect(screen.getByText("GitHub connection suspended")).toBeTruthy();
  });

  it("revoked installations show the reconnect state", async () => {
    listInstallationsMock.mockResolvedValue([
      installation({ revokedAt: new Date() }),
    ]);
    render(await renderDashboard());
    expect(screen.getByText(/previous GitHub connection was removed/)).toBeTruthy();
    expect(screen.getByText("Connect GitHub")).toBeTruthy();
  });

  it("renders safe error banners from known error codes only", async () => {
    render(await renderDashboard({ error: "installation_unavailable" }));
    expect(
      screen.getByText(/already connected to another DoFast account/)
    ).toBeTruthy();
    cleanup();
    render(await renderDashboard({ error: "<script>alert(1)</script>" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
