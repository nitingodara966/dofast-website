import "server-only";
import { z } from "zod";

const GITHUB_API = "https://api.github.com";
const MAX_PAGES = 3; // 300 repos is plenty for MVP listing
const MAX_PACKAGE_JSON_BYTES = 300_000;

function installationHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "dofast-app",
  };
}

const repoSchema = z
  .object({
    id: z.number().int().positive(),
    full_name: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    private: z.boolean(),
    default_branch: z.string(),
    archived: z.boolean().optional(),
  })
  .loose();

export type RepoSummary = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  archived: boolean;
};

function toSummary(repo: z.infer<typeof repoSchema>): RepoSummary {
  return {
    id: repo.id,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    archived: repo.archived ?? false,
  };
}

/** All repositories the installation grants access to (paginated). */
export async function listInstallationRepositories(
  token: string
): Promise<RepoSummary[]> {
  const listSchema = z
    .object({ total_count: z.number(), repositories: z.array(repoSchema) })
    .loose();

  const repos: RepoSummary[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${GITHUB_API}/installation/repositories?per_page=100&page=${page}`,
      { headers: installationHeaders(token) }
    );
    if (!res.ok) {
      console.error(`github: list repositories failed with status ${res.status}`);
      throw new Error("GitHub API request failed");
    }
    const parsed = listSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.error("github: unexpected repository list payload shape");
      throw new Error("GitHub API request failed");
    }
    repos.push(...parsed.data.repositories.map(toSummary));
    if (
      parsed.data.repositories.length < 100 ||
      repos.length >= parsed.data.total_count
    ) {
      break;
    }
  }
  return repos;
}

/**
 * Fetch one repository by id using the installation token. Installation
 * tokens can only see granted repositories, so a 404 doubles as the
 * access-validation check for repository selection.
 */
export async function getInstallationRepository(
  token: string,
  repoId: number
): Promise<RepoSummary | null> {
  const res = await fetch(`${GITHUB_API}/repositories/${repoId}`, {
    headers: installationHeaders(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`github: get repository failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = repoSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("github: unexpected repository payload shape");
    throw new Error("GitHub API request failed");
  }
  return toSummary(parsed.data);
}

/** Root package.json contents, or null when absent/oversized. */
export async function fetchRepoPackageJson(
  token: string,
  repoFullName: string
): Promise<string | null> {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repoFullName)) return null;
  const res = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/contents/package.json`,
    { headers: installationHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`github: get package.json failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = z
    .object({ content: z.string(), encoding: z.string(), size: z.number() })
    .loose()
    .safeParse(await res.json());
  if (!parsed.success) return null;
  if (parsed.data.encoding !== "base64") return null;
  if (parsed.data.size > MAX_PACKAGE_JSON_BYTES) return null;
  return Buffer.from(parsed.data.content, "base64").toString("utf8");
}
