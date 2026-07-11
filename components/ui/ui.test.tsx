import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Button } from "./button";
import { TextField } from "./field";
import { Dialog } from "./overlay";
import { DropdownMenu } from "./dropdown";

afterEach(() => cleanup());

describe("Button", () => {
  it("renders variants and blocks interaction while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByText("Save").closest("button")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("TextField", () => {
  it("associates a real label with the input (no placeholder-as-label)", () => {
    render(<TextField label="Email address" type="email" />);
    const input = screen.getByLabelText("Email address") as HTMLInputElement;
    expect(input.type).toBe("email");
  });

  it("exposes errors via role=alert and aria-invalid", () => {
    render(<TextField label="Email address" error="Enter a valid email." />);
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email.");
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).getAttribute(
        "aria-invalid"
      )
    ).toBe("true");
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirm thing">
        <button>First</button>
        <button>Last</button>
      </Dialog>
    </div>
  );
}

describe("Dialog accessibility contract", () => {
  it("labels itself, traps Tab in both directions, closes on Escape, restores focus", () => {
    render(<DialogHarness />);
    const opener = screen.getByText("Open dialog");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Confirm thing")).toBeTruthy();

    // initial focus lands inside
    const first = screen.getByText("First");
    const last = screen.getByText("Last");
    expect(document.activeElement).toBe(first);

    // Tab from last wraps to first
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from first wraps to last
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Escape closes and restores invoker focus
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on backdrop mousedown", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByText("Open dialog"));
    fireEvent.mouseDown(screen.getByTestId("overlay-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DropdownMenu accessibility contract", () => {
  const items = [
    { label: "Account", onSelect: vi.fn() },
    { label: "Sign out", onSelect: vi.fn(), destructive: true },
  ];

  it("opens with correct ARIA, arrows through items, Escape restores trigger focus", () => {
    render(<DropdownMenu trigger="Menu" items={items} />);
    const trigger = screen.getByText("Menu").closest("button")!;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Account");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Sign out");
    fireEvent.keyDown(menu, { key: "ArrowDown" }); // wraps
    expect(document.activeElement?.textContent).toBe("Account");
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Sign out");

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("activates items and closes on outside click", () => {
    const onSelect = vi.fn();
    render(
      <div>
        <DropdownMenu trigger="Menu" items={[{ label: "Do it", onSelect }]} />
        <button>Elsewhere</button>
      </div>
    );
    fireEvent.click(screen.getByText("Menu"));
    fireEvent.click(screen.getByRole("menuitem"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByText("Menu"));
    fireEvent.mouseDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
