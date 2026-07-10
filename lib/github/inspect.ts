import "server-only";
import { z } from "zod";
import { installationHeaders } from "./repos";
import { githubFetch } from "./fetch";

const GITHUB_API = "https://api.github.com";
const FULL_NAME_RE = /^[^/\s]+\/[^/\s]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;

// Read-only module: only GET requests, ever. Errors are generic; no request
// headers, tokens, or file contents appear in logs.

export async function getBranchHeadSha(
  token: string,
  repoFullName: string,
  branch: string
): Promise<string | null> {
  if (!FULL_NAME_RE.test(repoFullName)) return null;
  const res = await githubFetch(
    `${GITHUB_API}/repos/${repoFullName}/branches/${encodeURIComponent(branch)}`,
    { headers: installationHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`github: get branch failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = z
    .object({ commit: z.object({ sha: z.string().regex(SHA_RE) }).loose() })
    .loose()
    .safeParse(await res.json());
  if (!parsed.success) {
    console.error("github: unexpected branch payload shape");
    throw new Error("GitHub API request failed");
  }
  return parsed.data.commit.sha;
}

export type TreeEntry = {
  path: string;
  mode: string;
  type: string; // "blob" | "tree" | "commit" (submodule)
  sha: string;
  size?: number;
};

const treeSchema = z
  .object({
    truncated: z.boolean(),
    tree: z.array(
      z
        .object({
          path: z.string(),
          mode: z.string(),
          type: z.string(),
          sha: z.string(),
          size: z.number().optional(),
        })
        .loose()
    ),
  })
  .loose();

/** Entire repository tree at a commit, in one call. */
export async function getRepoTree(
  token: string,
  repoFullName: string,
  commitSha: string
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  if (!FULL_NAME_RE.test(repoFullName) || !SHA_RE.test(commitSha)) {
    throw new Error("GitHub API request failed");
  }
  const res = await githubFetch(
    `${GITHUB_API}/repos/${repoFullName}/git/trees/${commitSha}?recursive=1`,
    { headers: installationHeaders(token) }
  );
  if (!res.ok) {
    console.error(`github: get tree failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = treeSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("github: unexpected tree payload shape");
    throw new Error("GitHub API request failed");
  }
  return { entries: parsed.data.tree, truncated: parsed.data.truncated };
}

/** Blob content by immutable SHA. Returns null when not base64-decodable. */
export async function getBlobText(
  token: string,
  repoFullName: string,
  blobSha: string
): Promise<string | null> {
  if (!FULL_NAME_RE.test(repoFullName) || !SHA_RE.test(blobSha)) {
    throw new Error("GitHub API request failed");
  }
  const res = await githubFetch(
    `${GITHUB_API}/repos/${repoFullName}/git/blobs/${blobSha}`,
    { headers: installationHeaders(token) }
  );
  if (!res.ok) {
    console.error(`github: get blob failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = z
    .object({ content: z.string(), encoding: z.string() })
    .loose()
    .safeParse(await res.json());
  if (!parsed.success || parsed.data.encoding !== "base64") return null;
  return Buffer.from(parsed.data.content, "base64").toString("utf8");
}
