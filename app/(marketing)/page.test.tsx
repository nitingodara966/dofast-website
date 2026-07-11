import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home from "./page";

describe("landing page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the hero, sections, and waitlist form", () => {
    render(<Home />);
    expect(screen.getAllByText("DoFast").length).toBeGreaterThan(0);
    expect(screen.getByText("Your website, updated by asking.")).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(
      screen.getByText("Built to be trusted with your live site")
    ).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getAllByText("Join the waitlist").length).toBeGreaterThan(0);
    // auth entry point preserved
    const login = screen.getByText("Log in") as HTMLAnchorElement;
    expect(login.getAttribute("href")).toBe("/login");
  });

  it("submits the waitlist form via /api/waitlist and shows the success state", async () => {
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);

    expect(await screen.findByText("You're on the list")).toBeTruthy();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/waitlist",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: "user@example.com" });
  });

  it("stays on the form and alerts when the API rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
          status: 400,
        })
      )
    );
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    render(<Home />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);

    await vi.waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(alertMock).toHaveBeenCalledWith("Please enter a valid email address.");
    expect(screen.queryByText("You're on the list")).toBeNull();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });
});
