import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRepoPackageJson,
  getInstallationRepository,
  listInstallationRepositories,
} from "./repos";

function repo(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    full_name: `owner/repo-${id}`,
    private: false,
    default_branch: "main",
    archived: false,
    ...overrides,
  };
}

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

describe("listInstallationRepositories", () => {
  it("returns a single page and sends the installation token", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ total_count: 2, repositories: [repo(1), repo(2, { private: true })] }),
        { status: 200 }
      )
    );
    const repos = await listInstallationRepositories("ghs_token");
    expect(repos).toHaveLength(2);
    expect(repos[1]).toEqual({
      id: 2,
      fullName: "owner/repo-2",
      private: true,
      defaultBranch: "main",
      archived: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/installation/repositories?per_page=100&page=1");
    expect(init.headers.Authorization).toBe("Bearer ghs_token");
  });

  it("paginates until all repositories are collected", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => repo(i + 1));
    const page2 = Array.from({ length: 50 }, (_, i) => repo(i + 101));
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 150, repositories: page1 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 150, repositories: page2 }), { status: 200 })
      );
    const repos = await listInstallationRepositories("ghs_token");
    expect(repos).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });

  it("throws a safe error on GitHub failures", async () => {
    fetchMock.mockResolvedValue(new Response("upstream detail", { status: 500 }));
    await expect(listInstallationRepositories("ghs_token")).rejects.toThrow(
      "GitHub API request failed"
    );
  });
});

describe("getInstallationRepository", () => {
  it("returns the repository when the installation can access it", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(repo(42)), { status: 200 }));
    const result = await getInstallationRepository("ghs_token", 42);
    expect(result?.fullName).toBe("owner/repo-42");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repositories/42");
  });

  it("returns null on 404 (repo outside the installation grant)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(getInstallationRepository("ghs_token", 42)).resolves.toBeNull();
  });
});

describe("fetchRepoPackageJson", () => {
  it("decodes base64 content", async () => {
    const content = Buffer.from('{"dependencies":{"next":"16.0.0"}}').toString("base64");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content, encoding: "base64", size: 40 }), { status: 200 })
    );
    await expect(fetchRepoPackageJson("ghs_token", "owner/repo")).resolves.toContain(
      '"next"'
    );
  });

  it("returns null when package.json is absent", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchRepoPackageJson("ghs_token", "owner/repo")).resolves.toBeNull();
  });

  it("returns null for oversized files and malformed repo names", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: "e30=", encoding: "base64", size: 400_000 }), {
        status: 200,
      })
    );
    await expect(fetchRepoPackageJson("ghs_token", "owner/repo")).resolves.toBeNull();
    await expect(fetchRepoPackageJson("ghs_token", "../evil/path")).resolves.toBeNull();
  });
});
