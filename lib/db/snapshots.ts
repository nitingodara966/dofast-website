import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { repoSnapshots } from "./schema";
import type { IndexedFile } from "../repo/filters";

export type SnapshotRecord = Omit<
  typeof repoSnapshots.$inferSelect,
  "fileIndex"
> & { fileIndex: IndexedFile[] };

export async function getSnapshotForSite(
  siteId: string
): Promise<SnapshotRecord | null> {
  const rows = await getDb()
    .select()
    .from(repoSnapshots)
    .where(eq(repoSnapshots.siteId, siteId));
  return (rows[0] as SnapshotRecord | undefined) ?? null;
}

export type SnapshotUpsertInput = {
  siteId: string;
  commitSha: string;
  ref: string;
  status: "ready" | "truncated";
  fileCount: number;
  skippedCount: number;
  totalSize: number;
  fileIndex: IndexedFile[];
  /** Build START time — ordering guard against slow stale builds. */
  indexedAt: Date;
};

/**
 * Store a successful build. The setWhere condition means a build that started
 * earlier can never overwrite a snapshot from a build that started later —
 * concurrent/slow builds lose, newest wins, state stays consistent.
 */
export async function upsertSnapshotSuccess(
  input: SnapshotUpsertInput
): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(repoSnapshots)
    .values({
      siteId: input.siteId,
      commitSha: input.commitSha,
      ref: input.ref,
      status: input.status,
      fileCount: input.fileCount,
      skippedCount: input.skippedCount,
      totalSize: input.totalSize,
      fileIndex: input.fileIndex,
      refreshError: null,
      refreshFailedAt: null,
      indexedAt: input.indexedAt,
      headCheckedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: repoSnapshots.siteId,
      set: {
        commitSha: input.commitSha,
        ref: input.ref,
        status: input.status,
        fileCount: input.fileCount,
        skippedCount: input.skippedCount,
        totalSize: input.totalSize,
        fileIndex: input.fileIndex,
        refreshError: null,
        refreshFailedAt: null,
        indexedAt: input.indexedAt,
        headCheckedAt: now,
        updatedAt: now,
      },
      setWhere: sql`${repoSnapshots.indexedAt} <= ${input.indexedAt}`,
    });
}

/**
 * Record a failed build/refresh WITHOUT destroying the last-known-good
 * snapshot: existing rows only gain refresh_error metadata; a placeholder
 * 'failed' row is inserted only when no snapshot ever succeeded. Its
 * indexed_at is epoch so any real build immediately supersedes it.
 */
export async function recordSnapshotFailure(
  siteId: string,
  ref: string,
  safeMessage: string
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const updated = await db
    .update(repoSnapshots)
    .set({ refreshError: safeMessage, refreshFailedAt: now, updatedAt: now })
    .where(eq(repoSnapshots.siteId, siteId))
    .returning({ id: repoSnapshots.id });
  if (updated.length > 0) return;

  await db
    .insert(repoSnapshots)
    .values({
      siteId,
      commitSha: "",
      ref,
      status: "failed",
      fileCount: 0,
      skippedCount: 0,
      totalSize: 0,
      fileIndex: [],
      refreshError: safeMessage,
      refreshFailedAt: now,
      indexedAt: new Date(0),
      headCheckedAt: now,
    })
    .onConflictDoNothing({ target: repoSnapshots.siteId });
}

/** Head was checked and unchanged — postpone the next staleness check. */
export async function touchSnapshotHeadChecked(siteId: string): Promise<void> {
  await getDb()
    .update(repoSnapshots)
    .set({ headCheckedAt: new Date() })
    .where(eq(repoSnapshots.siteId, siteId));
}
