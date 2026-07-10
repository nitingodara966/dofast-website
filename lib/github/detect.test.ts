import { describe, expect, it } from "vitest";
import { detectFramework } from "./detect";

describe("detectFramework", () => {
  it("detects Next.js (takes precedence over react)", () => {
    expect(
      detectFramework(
        JSON.stringify({ dependencies: { next: "16.2.9", react: "19.0.0" } })
      )
    ).toBe("nextjs");
  });

  it("detects Next.js in devDependencies", () => {
    expect(
      detectFramework(JSON.stringify({ devDependencies: { next: "canary" } }))
    ).toBe("nextjs");
  });

  it("detects plain React", () => {
    expect(
      detectFramework(JSON.stringify({ dependencies: { react: "19.0.0" } }))
    ).toBe("react");
  });

  it("returns null for unsupported stacks", () => {
    expect(
      detectFramework(JSON.stringify({ dependencies: { vue: "3.0.0" } }))
    ).toBeNull();
  });

  it("returns null for missing, malformed, non-object, or oversized input", () => {
    expect(detectFramework(null)).toBeNull();
    expect(detectFramework("{not json")).toBeNull();
    expect(detectFramework('"just a string"')).toBeNull();
    expect(detectFramework("x".repeat(600_000))).toBeNull();
  });
});
