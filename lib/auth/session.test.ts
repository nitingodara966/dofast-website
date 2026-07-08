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

import { getUser, requireUser } from "./session";

const sessionFixture = {
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    emailVerified: false,
  },
};

describe("getUser", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    redirectMock.mockClear();
  });

  it("returns a minimal safe user shape for an active session", async () => {
    getSessionMock.mockResolvedValue(sessionFixture);
    await expect(getUser()).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
      name: "User",
    });
  });

  it("returns null without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(getUser()).resolves.toBeNull();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    redirectMock.mockClear();
  });

  it("returns the user when authenticated", async () => {
    getSessionMock.mockResolvedValue(sessionFixture);
    await expect(requireUser()).resolves.toMatchObject({ id: "user-1" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
