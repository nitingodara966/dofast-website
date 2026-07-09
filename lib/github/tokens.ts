import "server-only";
import { z } from "zod";
import { githubAppHeaders } from "./app";
import { markInstallationRevoked } from "../db/installations";

const tokenResponseSchema = z
  .object({ token: z.string(), expires_at: z.string() })
  .loose();

export type InstallationState = {
  installationId: number;
  suspendedAt: Date | null;
  revokedAt: Date | null;
};

export type InstallationToken = { token: string; expiresAt: string };

/**
 * Mint a short-lived (~1h) installation access token. Tokens are returned to
 * the caller for immediate use and are never persisted or logged anywhere.
 * Refuses revoked/suspended installations before touching GitHub; a 404 from
 * GitHub means the installation was uninstalled — lazily reconcile.
 */
export async function mintInstallationToken(
  installation: InstallationState
): Promise<InstallationToken> {
  if (installation.revokedAt) {
    throw new Error("GitHub installation is disconnected");
  }
  if (installation.suspendedAt) {
    throw new Error("GitHub installation is suspended");
  }

  const res = await fetch(
    `https://api.github.com/app/installations/${installation.installationId}/access_tokens`,
    { method: "POST", headers: githubAppHeaders() }
  );

  if (res.status === 404) {
    await markInstallationRevoked(installation.installationId);
    throw new Error("GitHub installation no longer exists");
  }
  if (!res.ok) {
    console.error(`github: token mint failed with status ${res.status}`);
    throw new Error("GitHub token request failed");
  }

  const parsed = tokenResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("github: unexpected token payload shape");
    throw new Error("GitHub token request failed");
  }
  return { token: parsed.data.token, expiresAt: parsed.data.expires_at };
}
