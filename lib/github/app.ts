import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";
import { getGitHubAppConfig, type GitHubAppConfig } from "./config";

const GITHUB_API = "https://api.github.com";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signed JWT authenticating DoFast as the GitHub App itself (RS256).
 * iat is backdated 60s for clock drift; lifetime stays under GitHub's
 * 10-minute maximum.
 */
export function createAppJwt(
  config: Pick<GitHubAppConfig, "appId" | "privateKeyPem">,
  now: number = Date.now()
): string {
  const iat = Math.floor(now / 1000) - 60;
  const exp = iat + 9 * 60;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat, exp, iss: config.appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(config.privateKeyPem).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

export function githubAppHeaders(config?: GitHubAppConfig): Record<string, string> {
  const resolved = config ?? getGitHubAppConfig();
  return {
    Authorization: `Bearer ${createAppJwt(resolved)}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "dofast-app",
  };
}

const installationInfoSchema = z
  .object({
    id: z.number().int().positive(),
    account: z.object({ login: z.string(), type: z.string() }).loose(),
    repository_selection: z.string().nullish(),
    permissions: z.record(z.string(), z.string()).optional(),
    suspended_at: z.string().nullish(),
  })
  .loose();

export type GitHubInstallationInfo = {
  id: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string | null;
  permissions: Record<string, string>;
  suspendedAt: string | null;
};

/**
 * Fetch an installation from GitHub, authenticated as the App. Returns null
 * when the installation does not exist (deleted/never existed).
 */
export async function getInstallation(
  installationId: number
): Promise<GitHubInstallationInfo | null> {
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: githubAppHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`github: get installation failed with status ${res.status}`);
    throw new Error("GitHub API request failed");
  }
  const parsed = installationInfoSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("github: unexpected installation payload shape");
    throw new Error("GitHub API request failed");
  }
  const data = parsed.data;
  return {
    id: data.id,
    accountLogin: data.account.login,
    accountType: data.account.type,
    repositorySelection: data.repository_selection ?? null,
    permissions: data.permissions ?? {},
    suspendedAt: data.suspended_at ?? null,
  };
}
