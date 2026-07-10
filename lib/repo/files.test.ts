import { beforeEach, describe, expect, it, vi } from "vitest";

const getBlobTextMock = vi.fn();
vi.mock("../github/inspect", () => ({
  getBlobText: (...a: unknown[]) => getBlobTextMock(...a),
}));

import { readSnapshotFile } from "./files";
import type { IndexedFile } from "./filters";

const fileIndex: IndexedFile[] = [
  { p: "app/page.tsx", s: 100, h: "a".repeat(40), r: "page" },
  { p: "big.ts", s: 900_000, h: "b".repeat(40), r: "other" },
];

const base = { token: "ghs_x", repoFullName: "owner/repo", fileIndex };

beforeEach(() => {
  getBlobTextMock.mockReset().mockResolvedValue("export default function Home() {}");
});

describe("readSnapshotFile", () => {
  it("reads a file that is in the index", async () => {
    const result = await readSnapshotFile({ ...base, path: "app/page.tsx" });
    expect(result).toEqual({ ok: true, text: "export default function Home() {}" });
    expect(getBlobTextMock).toHaveBeenCalledWith("ghs_x", "owner/repo", "a".repeat(40));
  });

  it("refuses paths not in the index", async () => {
    const result = await readSnapshotFile({ ...base, path: "lib/other.ts" });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(getBlobTextMock).not.toHaveBeenCalled();
  });

  it("refuses traversal, absolute, and control-char paths", async () => {
    for (const path of ["../secret", "/etc/passwd", "a\0b", "app/../.env", ""]) {
      const result = await readSnapshotFile({ ...base, path });
      expect(result.ok).toBe(false);
    }
    expect(getBlobTextMock).not.toHaveBeenCalled();
  });

  it("refuses sensitive paths even if somehow present in an index", async () => {
    const poisoned = [...fileIndex, { p: ".env.local", s: 10, h: "c".repeat(40), r: "other" as const }];
    const result = await readSnapshotFile({ ...base, fileIndex: poisoned, path: ".env.local" });
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(getBlobTextMock).not.toHaveBeenCalled();
  });

  it("refuses oversized files without fetching", async () => {
    const result = await readSnapshotFile({ ...base, path: "big.ts" });
    expect(result).toEqual({ ok: false, reason: "too-large" });
    expect(getBlobTextMock).not.toHaveBeenCalled();
  });

  it("refuses binary content detected at read time", async () => {
    getBlobTextMock.mockResolvedValue("PNG\0\0\0data");
    const result = await readSnapshotFile({ ...base, path: "app/page.tsx" });
    expect(result).toEqual({ ok: false, reason: "binary" });
  });

  it("maps GitHub failures to a safe unavailable result", async () => {
    getBlobTextMock.mockRejectedValue(new Error("internal ECONNREFUSED"));
    const result = await readSnapshotFile({ ...base, path: "app/page.tsx" });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
