import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBlobText, getBranchHeadSha, getRepoTree } from "./inspect";

vi.mock("./repos", () => ({
  installationHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
}));

const SHA = "a".repeat(40);
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getBranchHeadSha", () => {
  it("returns the head commit sha", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ commit: { sha: SHA } }), { status: 200 })
    );
    await expect(getBranchHeadSha("t", "owner/repo", "main")).resolves.toBe(SHA);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/owner/repo/branches/main"
    );
  });

  it("returns null for a missing branch", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(getBranchHeadSha("t", "owner/repo", "gone")).resolves.toBeNull();
  });

  it("throws a safe error on server failures", async () => {
    fetchMock.mockResolvedValue(new Response("internal detail", { status: 500 }));
    await expect(getBranchHeadSha("t", "owner/repo", "main")).rejects.toThrow(
      "GitHub API request failed"
    );
  });
});

describe("getRepoTree", () => {
  it("returns entries and the truncated flag", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          truncated: true,
          tree: [{ path: "app/page.tsx", mode: "100644", type: "blob", sha: SHA, size: 10 }],
        }),
        { status: 200 }
      )
    );
    const result = await getRepoTree("t", "owner/repo", SHA);
    expect(result.truncated).toBe(true);
    expect(result.entries[0].path).toBe("app/page.tsx");
    expect(fetchMock.mock.calls[0][0]).toContain(`git/trees/${SHA}?recursive=1`);
  });

  it("rejects malformed shas without calling GitHub", async () => {
    await expect(getRepoTree("t", "owner/repo", "not-a-sha")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getBlobText", () => {
  it("decodes base64 blob content", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: Buffer.from("hello world").toString("base64"),
          encoding: "base64",
        }),
        { status: 200 }
      )
    );
    await expect(getBlobText("t", "owner/repo", SHA)).resolves.toBe("hello world");
  });

  it("returns null for unexpected encodings", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: "x", encoding: "utf-8" }), { status: 200 })
    );
    await expect(getBlobText("t", "owner/repo", SHA)).resolves.toBeNull();
  });
});
