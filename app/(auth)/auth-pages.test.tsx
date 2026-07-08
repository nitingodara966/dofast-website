import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getUser: () => getUserMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/components/auth-form", () => ({
  AuthForm: ({ mode }: { mode: string }) => <div>form:{mode}</div>,
}));

import LoginPage from "./login/page";
import SignupPage from "./signup/page";

describe("auth pages", () => {
  beforeEach(() => getUserMock.mockReset());

  it("redirect already-authenticated users to the dashboard", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    await expect(LoginPage()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(SignupPage()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("render the forms for anonymous visitors", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(LoginPage()).resolves.toBeTruthy();
    await expect(SignupPage()).resolves.toBeTruthy();
  });
});
