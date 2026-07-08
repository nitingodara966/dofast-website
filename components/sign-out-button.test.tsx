import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const signOutMock = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: () => signOutMock() },
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    signOutMock.mockReset().mockResolvedValue(undefined);
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => cleanup());

  it("signs out and redirects to /login", async () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalled();
  });
});
