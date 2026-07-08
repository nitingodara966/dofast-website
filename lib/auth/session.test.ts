import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("./index", () => ({
  getAuth: () => ({ api: { getSession: getSessionMock } }),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { getUser, requireUser, requireOnboardedUser } from "./session";

const onboardedAt = new Date("2026-07-01T00:00:00Z");

function sessionFor(onboardingCompletedAt: Date | null) {
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      emailVerified: false,
      onboardingCompletedAt,
    },
  };
}

beforeEach(() => {
  getSessionMock.mockReset();
  redirectMock.mockClear();
});

describe("getUser", () => {
  it("returns a minimal safe user shape including onboarding state", async () => {
    getSessionMock.mockResolvedValue(sessionFor(onboardedAt));
    await expect(getUser()).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      onboardingCompletedAt: onboardedAt,
    });
  });

  it("defaults onboardingCompletedAt to null when absent", async () => {
    const session = sessionFor(null);
    delete (session.user as Record<string, unknown>).onboardingCompletedAt;
    getSessionMock.mockResolvedValue(session);
    await expect(getUser()).resolves.toMatchObject({
      onboardingCompletedAt: null,
    });
  });

  it("returns null without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(getUser()).resolves.toBeNull();
  });
});

describe("requireUser", () => {
  it("returns the user when authenticated", async () => {
    getSessionMock.mockResolvedValue(sessionFor(null));
    await expect(requireUser()).resolves.toMatchObject({ id: "user-1" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("requireOnboardedUser", () => {
  it("returns the user when onboarding is complete", async () => {
    getSessionMock.mockResolvedValue(sessionFor(onboardedAt));
    await expect(requireOnboardedUser()).resolves.toMatchObject({
      id: "user-1",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects new users to /onboarding", async () => {
    getSessionMock.mockResolvedValue(sessionFor(null));
    await expect(requireOnboardedUser()).rejects.toThrow(
      "REDIRECT:/onboarding"
    );
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("redirects unauthenticated users to /login before onboarding checks", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireOnboardedUser()).rejects.toThrow("REDIRECT:/login");
  });
});
