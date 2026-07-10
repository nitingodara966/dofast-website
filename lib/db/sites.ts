import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { sites } from "./schema";

export type SiteRecord = typeof sites.$inferSelect;

export type CreateSiteInput = {
  userId: string;
  installationId: number;
  repoId: number;
  repoFullName: string;
  defaultBranch: string;
  framework: string;
};

/**
 * Idempotent, race-safe site creation: UNIQUE(user_id, repo_id) plus upsert.
 * Re-selecting an existing repo refreshes metadata and reactivates a
 * disconnected site instead of duplicating it.
 */
export async function createSite(
  input: CreateSiteInput
): Promise<"created" | "already-connected"> {
  const db = getDb();
  const [existing] = await db
    .select({ id: sites.id, status: sites.status })
    .from(sites)
    .where(and(eq(sites.userId, input.userId), eq(sites.repoId, input.repoId)));

  await db
    .insert(sites)
    .values({
      userId: input.userId,
      installationId: input.installationId,
      repoId: input.repoId,
      repoFullName: input.repoFullName,
      defaultBranch: input.defaultBranch,
      framework: input.framework,
    })
    .onConflictDoUpdate({
      target: [sites.userId, sites.repoId],
      set: {
        installationId: input.installationId,
        repoFullName: input.repoFullName,
        defaultBranch: input.defaultBranch,
        framework: input.framework,
        status: "active",
        disconnectedAt: null,
        updatedAt: new Date(),
      },
    });

  return existing?.status === "active" ? "already-connected" : "created";
}

export async function listSitesForUser(userId: string): Promise<SiteRecord[]> {
  return getDb()
    .select()
    .from(sites)
    .where(eq(sites.userId, userId))
    .orderBy(desc(sites.createdAt));
}

/**
 * Webhook invalidation: repositories removed from an installation's grant
 * disconnect the matching active sites. Returns how many were disconnected.
 */
export async function disconnectSitesForRepos(
  installationId: number,
  repoIds: number[]
): Promise<number> {
  if (repoIds.length === 0) return 0;
  const rows = await getDb()
    .update(sites)
    .set({ status: "disconnected", disconnectedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(sites.installationId, installationId),
        inArray(sites.repoId, repoIds),
        eq(sites.status, "active")
      )
    )
    .returning({ id: sites.id });
  return rows.length;
}

/** Uninstall invalidation: every active site of the installation. */
export async function disconnectSitesForInstallation(
  installationId: number
): Promise<number> {
  const rows = await getDb()
    .update(sites)
    .set({ status: "disconnected", disconnectedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(sites.installationId, installationId), eq(sites.status, "active"))
    )
    .returning({ id: sites.id });
  return rows.length;
}
