import "server-only";
import { mintInstallationToken } from "../github/tokens";
import { getBranchHeadSha, getRepoTree } from "../github/inspect";
import { buildFileIndex } from "./filters";
import {
  getSnapshotForSite,
  recordSnapshotFailure,
  touchSnapshotHeadChecked,
  upsertSnapshotSuccess,
  type SnapshotRecord,
} from "../db/snapshots";

export const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type SnapshotSite = {
  id: string;
  repoFullName: string;
  defaultBranch: string;
};

export type SnapshotInstallation = {
  installationId: number;
  suspendedAt: Date | null;
  revokedAt: Date | null;
};

// Per-instance in-flight dedup: concurrent requests for the same site share
// one build. Cross-instance duplicates are bounded (a build is 2 GitHub
// calls) and resolved consistently by the DAL's ordered upsert.
const inFlight = new Map<string, Promise<SnapshotRecord | null>>();

/**
 * Ensure a current snapshot for the site. Never throws: failures are recorded
 * (without destroying the last-known-good snapshot) and the freshest
 * available snapshot — possibly with refreshError set — is returned.
 */
export async function refreshSnapshot(
  site: SnapshotSite,
  installation: SnapshotInstallation,
  { force = false }: { force?: boolean } = {}
): Promise<SnapshotRecord | null> {
  const existing = await getSnapshotForSite(site.id);
  if (
    !force &&
    existing &&
    existing.status !== "failed" &&
    Date.now() - existing.headCheckedAt.getTime() < SNAPSHOT_TTL_MS
  ) {
    return existing;
  }

  const running = inFlight.get(site.id);
  if (running) return running;

  const promise = buildSnapshot(site, installation, existing).finally(() => {
    inFlight.delete(site.id);
  });
  inFlight.set(site.id, promise);
  return promise;
}

async function buildSnapshot(
  site: SnapshotSite,
  installation: SnapshotInstallation,
  existing: SnapshotRecord | null
): Promise<SnapshotRecord | null> {
  const startedAt = new Date();

  const fail = async (safeMessage: string) => {
    console.error(`snapshot: build failed for site ${site.id}: ${safeMessage}`);
    await recordSnapshotFailure(site.id, site.defaultBranch, safeMessage);
    return getSnapshotForSite(site.id);
  };

  let token: string;
  try {
    token = (await mintInstallationToken(installation)).token;
  } catch {
    return fail("GitHub connection is unavailable");
  }

  let headSha: string | null;
  try {
    headSha = await getBranchHeadSha(token, site.repoFullName, site.defaultBranch);
  } catch {
    return fail("Could not reach GitHub");
  }
  if (!headSha) return fail("Repository branch not found");

  // Unchanged head: the existing snapshot is current — just postpone the TTL.
  if (existing && existing.status !== "failed" && existing.commitSha === headSha) {
    await touchSnapshotHeadChecked(site.id);
    return getSnapshotForSite(site.id);
  }

  let tree;
  try {
    tree = await getRepoTree(token, site.repoFullName, headSha);
  } catch {
    return fail("Could not reach GitHub");
  }

  const index = buildFileIndex(tree.entries);
  const status: "ready" | "truncated" =
    tree.truncated || index.truncatedByCaps ? "truncated" : "ready";

  await upsertSnapshotSuccess({
    siteId: site.id,
    commitSha: headSha,
    ref: site.defaultBranch,
    status,
    fileCount: index.files.length,
    skippedCount: index.skippedCount,
    totalSize: index.totalSize,
    fileIndex: index.files,
    indexedAt: startedAt,
  });
  return getSnapshotForSite(site.id);
}
