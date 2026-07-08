import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const updateWhereMock = vi.fn().mockResolvedValue(undefined);
const updateSetMock = vi.fn((values: { onboardingCompletedAt: Date }) => {
  void values;
  return { where: updateWhereMock };
});
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    update: () => ({ set: updateSetMock }),
  }),
}));

import OnboardingPage from "./page";
import { completeOnboarding } from "./actions";

const newUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Nitin",
  onboardingCompletedAt: null,
};

beforeEach(() => {
  requireUserMock.mockReset();
  redirectMock.mockClear();
  updateSetMock.mockClear();
  updateWhereMock.mockClear();
});

afterEach(() => cleanup());

describe("onboarding page", () => {
  it("renders the product explanation and CTA for a new user", async () => {
    requireUserMock.mockResolvedValue(newUser);
    render(await OnboardingPage());

    expect(screen.getByText(/Welcome to DoFast, Nitin/)).toBeTruthy();
    expect(screen.getByText(/connect your website and update it by chatting with AI/i)).toBeTruthy();
    expect(screen.getByText("Connect your website")).toBeTruthy();
    expect(screen.getByText("GitHub — coming soon")).toBeTruthy();
    expect(screen.getByText("Preview, then publish")).toBeTruthy();
    expect(
      screen.getByText("Got it — take me to my dashboard")
    ).toBeTruthy();
  });

  it("redirects already-onboarded users to the dashboard", async () => {
    requireUserMock.mockResolvedValue({
      ...newUser,
      onboardingCompletedAt: new Date(),
    });
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("requires authentication (requireUser redirect propagates)", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("completeOnboarding server action", () => {
  it("marks onboarding complete for the session user and redirects to the dashboard", async () => {
    requireUserMock.mockResolvedValue(newUser);
    await expect(completeOnboarding()).rejects.toThrow("REDIRECT:/dashboard");

    expect(updateSetMock).toHaveBeenCalledTimes(1);
    const setArg = updateSetMock.mock.calls[0][0];
    expect(setArg.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(updateWhereMock).toHaveBeenCalledTimes(1);
  });

  it("never touches the database for unauthenticated callers", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(completeOnboarding()).rejects.toThrow("REDIRECT:/login");
    expect(updateSetMock).not.toHaveBeenCalled();
  });
});
