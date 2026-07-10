import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { githubInstallations } from "./schema";

export type InstallationRecord = typeof githubInstallations.$inferSelect;

export type ClaimInput = {
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string | null;
  permissions: Record<string, string>;
  suspendedAt: Date | null;
};

export type ClaimResult = "claimed" | "already-owned" | "owned-by-other";

/**
 * Atomically claim an installation for a user. The UNIQUE constraint on
 * installation_id arbitrates all concurrent claims — exactly one insert wins;
 * everyone else takes the conflict path below.
 */
export async function claimInstallation(input: ClaimInput): Promise<ClaimResult> {
  const db = getDb();
  const inserted = await db
    .insert(githubInstallations)
    .values({
      userId: input.userId,
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      repositorySelection: input.repositorySelection,
      permissions: input.permissions,
      suspendedAt: input.suspendedAt,
    })
    .onConflictDoNothing({ target: githubInstallations.installationId })
    .returning({ id: githubInstallations.id });
  if (inserted.length > 0) return "claimed";

  const [existing] = await db
    .select({
      id: githubInstallations.id,
      userId: githubInstallations.userId,
    })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, input.installationId));

  if (!existing || existing.userId !== input.userId) return "owned-by-other";

  // Same owner re-completing setup (refresh, replay, or setup_action=update):
  // refresh metadata from the GitHub-verified payload.
  await db
    .update(githubInstallations)
    .set({
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      repositorySelection: input.repositorySelection,
      permissions: input.permissions,
      suspendedAt: input.suspendedAt,
      revokedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(githubInstallations.id, existing.id));
  return "already-owned";
}

export async function listInstallationsForUser(
  userId: string
): Promise<InstallationRecord[]> {
  return getDb()
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.userId, userId))
    .orderBy(desc(githubInstallations.createdAt));
}

/** @returns true when a live row was revoked; false = unknown installation. */
export async function markInstallationRevoked(
  installationId: number
): Promise<boolean> {
  const rows = await getDb()
    .update(githubInstallations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(githubInstallations.installationId, installationId),
        isNull(githubInstallations.revokedAt)
      )
    )
    .returning({ id: githubInstallations.id });
  return rows.length > 0;
}

export async function setInstallationSuspended(
  installationId: number,
  suspended: boolean
): Promise<boolean> {
  const rows = await getDb()
    .update(githubInstallations)
    .set({ suspendedAt: suspended ? new Date() : null, updatedAt: new Date() })
    .where(eq(githubInstallations.installationId, installationId))
    .returning({ id: githubInstallations.id });
  return rows.length > 0;
}

export async function updateInstallationPermissions(
  installationId: number,
  permissions: Record<string, string>
): Promise<boolean> {
  const rows = await getDb()
    .update(githubInstallations)
    .set({ permissions, updatedAt: new Date() })
    .where(eq(githubInstallations.installationId, installationId))
    .returning({ id: githubInstallations.id });
  return rows.length > 0;
}

export async function updateInstallationRepositorySelection(
  installationId: number,
  repositorySelection: string
): Promise<boolean> {
  const rows = await getDb()
    .update(githubInstallations)
    .set({ repositorySelection, updatedAt: new Date() })
    .where(eq(githubInstallations.installationId, installationId))
    .returning({ id: githubInstallations.id });
  return rows.length > 0;
}

/** Lookup by GitHub's numeric installation id (unique). */
export async function getInstallationRecord(
  installationId: number
): Promise<InstallationRecord | null> {
  const rows = await getDb()
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId));
  return rows[0] ?? null;
}
