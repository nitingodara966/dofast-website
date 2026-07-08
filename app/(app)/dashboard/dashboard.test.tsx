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

import AppLayout from "../layout";
import DashboardPage from "./page";

const onboardedUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

describe("protected dashboard", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireOnboardedUserMock.mockReset();
  });

  afterEach(() => cleanup());

  it("layout renders branding, user identity, and sign-out for an authenticated user", async () => {
    requireUserMock.mockResolvedValue(onboardedUser);
    render(await AppLayout({ children: <div>page-content</div> }));

    expect(screen.getByText("DoFast")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
    expect(screen.getByText("page-content")).toBeTruthy();
  });

  it("layout never renders for unauthenticated users (requireUser redirects)", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(
      AppLayout({ children: <div>secret</div> })
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("dashboard shows the empty state and a disabled Connect Website entry point", async () => {
    requireOnboardedUserMock.mockResolvedValue(onboardedUser);
    render(await DashboardPage());
    expect(screen.getByText("No websites connected yet")).toBeTruthy();
    const connect = screen.getByText(/Connect Website/) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
  });

  it("dashboard sends not-yet-onboarded users to onboarding", async () => {
    requireOnboardedUserMock.mockRejectedValue(
      new Error("REDIRECT:/onboarding")
    );
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/onboarding");
  });
});
