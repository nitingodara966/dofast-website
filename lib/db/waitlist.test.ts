import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const returningMock = vi.fn();
const valuesMock = vi.fn();

vi.mock("./index", () => ({
  getDb: () => ({
    insert: () => ({
      values: (values: unknown) => {
        valuesMock(values);
        return {
          onConflictDoNothing: () => ({ returning: returningMock }),
        };
      },
    }),
  }),
}));

import { addWaitlistSignup, normalizeEmail } from "./waitlist";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("addWaitlistSignup", () => {
  beforeEach(() => {
    valuesMock.mockReset();
    returningMock.mockReset();
  });

  it("inserts the normalized email and reports created=true for new rows", async () => {
    returningMock.mockResolvedValue([{ id: "row-1" }]);
    const result = await addWaitlistSignup("  User@Example.COM ", "landing_page");
    expect(result).toEqual({ created: true });
    expect(valuesMock).toHaveBeenCalledWith({
      email: "user@example.com",
      source: "landing_page",
    });
  });

  it("reports created=false when the email already exists (conflict skipped)", async () => {
    returningMock.mockResolvedValue([]);
    const result = await addWaitlistSignup("user@example.com");
    expect(result).toEqual({ created: false });
  });

  it("propagates database errors to the caller", async () => {
    returningMock.mockRejectedValue(new Error("connection refused"));
    await expect(addWaitlistSignup("user@example.com")).rejects.toThrow(
      "connection refused"
    );
  });
});
