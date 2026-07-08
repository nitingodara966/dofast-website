import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const signUpEmailMock = vi.fn();
const signInEmailMock = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) },
    signIn: { email: (...args: unknown[]) => signInEmailMock(...args) },
  },
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { AuthForm } from "./auth-form";

function fill(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });
}

describe("AuthForm", () => {
  beforeEach(() => {
    signUpEmailMock.mockReset().mockResolvedValue({ data: {}, error: null });
    signInEmailMock.mockReset().mockResolvedValue({ data: {}, error: null });
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => cleanup());

  it("signup: requires name, email, and 8+ char password fields", () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByPlaceholderText("Your name")).toHaveProperty("required", true);
    expect(screen.getByPlaceholderText("Email address")).toHaveProperty("type", "email");
    expect(screen.getByPlaceholderText("Email address")).toHaveProperty("required", true);
    const password = screen.getByPlaceholderText("Password") as HTMLInputElement;
    expect(password.required).toBe(true);
    expect(password.minLength).toBe(8);
    expect(password.type).toBe("password");
  });

  it("signup: submits credentials and navigates to the dashboard", async () => {
    render(<AuthForm mode="signup" />);
    fill("Your name", "Nitin");
    fill("Email address", "user@example.com");
    fill("Password", "supersecret1");
    fireEvent.click(screen.getByText("Create account"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(signUpEmailMock).toHaveBeenCalledWith({
      name: "Nitin",
      email: "user@example.com",
      password: "supersecret1",
    });
  });

  it("login: submits credentials and navigates to the dashboard", async () => {
    render(<AuthForm mode="login" />);
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    fill("Email address", "user@example.com");
    fill("Password", "supersecret1");
    fireEvent.click(screen.getByText("Sign in"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(signInEmailMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "supersecret1",
    });
  });

  it("login: shows the server's safe error message and does not navigate", async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    });
    render(<AuthForm mode="login" />);
    fill("Email address", "user@example.com");
    fill("Password", "wrongpassword");
    fireEvent.click(screen.getByText("Sign in"));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Invalid email or password"
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("login: shows a generic message when the request throws, leaking nothing", async () => {
    signInEmailMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432"));
    render(<AuthForm mode="login" />);
    fill("Email address", "user@example.com");
    fill("Password", "supersecret1");
    fireEvent.click(screen.getByText("Sign in"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Something went wrong. Please try again.");
    expect(alert.textContent).not.toContain("ECONNREFUSED");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
