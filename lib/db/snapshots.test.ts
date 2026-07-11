import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Fake single-row store that emulates the exact Postgres semantics our
 * safety guarantees rely on: `ON CONFLICT ... DO UPDATE SET ... WHERE`
 * (with the WHERE evaluated from the REAL rendered SQL produced by the DAL),
 * `ON CONFLICT DO NOTHING`, and plain UPDATE ... RETURNING.
 */
type Row = Record<string, unknown> | null;
let row: Row = null;
let lastRenderedSetWhere: { sql: string; params: unknown[] } | null = null;

const dialect = new PgDialect();

vi.mock("./index", () => ({
  getDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async (config: {
          set: Record<string, unknown>;
          setWhere: SQL;
        }) => {
          if (!row) {
            row = { ...values };
            return;
          }
          const rendered = dialect.sqlToQuery(config.setWhere);
          lastRenderedSetWhere = { sql: rendered.sql, params: rendered.params };
          // The DAL's guard must be exactly: indexed_at <= $newBuildStart
          if (!/"indexed_at" <= \$/.test(rendered.sql)) {
            throw new Error(`unexpected setWhere: ${rendered.sql}`);
          }
          // Production regression (ERR_INVALID_ARG_TYPE): postgres.js requires
          // driver-serializable params — a raw Date instance here crashed the
          // first authenticated snapshot build. The param must arrive already
          // column-encoded as a string.
          const param = rendered.params[0];
          if (param instanceof Date) {
            throw new Error(
              "setWhere param is a raw Date — driver serialization boundary violated"
            );
          }
          if (typeof param !== "string") {
            throw new Error(`setWhere param must be a string, got ${typeof param}`);
          }
          if ((row.indexedAt as Date).getTime() <= new Date(param).getTime()) {
            row = { ...row, ...config.set };
          }
        },
        onConflictDoNothing: async () => {
          if (!row) row = { ...values };
        },
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            if (!row) return [];
            row = { ...row, ...set };
            return [{ id: "row-1" }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({ where: async () => (row ? [row] : []) }),
    }),
  }),
}));

import {
  getSnapshotForSite,
  recordSnapshotFailure,
  upsertSnapshotSuccess,
} from "./snapshots";

const t1 = new Date("2026-07-10T10:00:00Z"); // older build start
const t2 = new Date("2026-07-10T10:00:05Z"); // newer build start
const t3 = new Date("2026-07-10T10:00:10Z");

function successInput(commitSha: string, indexedAt: Date) {
  return {
    siteId: "site-1",
    commitSha,
    ref: "main",
    status: "ready" as const,
    fileCount: 1,
    skippedCount: 0,
    totalSize: 10,
    fileIndex: [{ p: "app/page.tsx", s: 10, h: "c".repeat(40), r: "page" as const }],
    indexedAt,
  };
}

beforeEach(() => {
  row = null;
  lastRenderedSetWhere = null;
});

describe("upsertSnapshotSuccess ordering guard", () => {
  it("renders the guard as indexed_at <= $buildStart with a driver-safe string param", async () => {
    await upsertSnapshotSuccess(successInput("B".repeat(40), t2)); // insert
    await upsertSnapshotSuccess(successInput("C".repeat(40), t3)); // conflict path
    expect(lastRenderedSetWhere?.sql).toMatch(/"repo_snapshots"\."indexed_at" <= \$/);
    const param = lastRenderedSetWhere?.params[0];
    // Exact production failure mode: a Date instance at this boundary crashes
    // postgres.js serialization (ERR_INVALID_ARG_TYPE). Must be an encoded string.
    expect(param).not.toBeInstanceOf(Date);
    expect(typeof param).toBe("string");
    expect(new Date(param as string).getTime()).toBe(t3.getTime());
  });

  it("stale build A (older start) cannot overwrite newer successful build B", async () => {
    await upsertSnapshotSuccess(successInput("B".repeat(40), t2)); // B commits first
    await upsertSnapshotSuccess(successInput("A".repeat(40), t1)); // A finishes late
    const snapshot = await getSnapshotForSite("site-1");
    expect(snapshot?.commitSha).toBe("B".repeat(40));
    expect(snapshot?.indexedAt).toEqual(t2);
  });

  it("an equal-start build may update (<= semantics)", async () => {
    await upsertSnapshotSuccess(successInput("B".repeat(40), t2));
    await upsertSnapshotSuccess(successInput("D".repeat(40), t2));
    expect((await getSnapshotForSite("site-1"))?.commitSha).toBe("D".repeat(40));
  });

  it("a newer build supersedes an older snapshot and clears failure metadata", async () => {
    await upsertSnapshotSuccess(successInput("B".repeat(40), t1));
    await recordSnapshotFailure("site-1", "main", "Could not reach GitHub");
    await upsertSnapshotSuccess(successInput("C".repeat(40), t2));
    const snapshot = await getSnapshotForSite("site-1");
    expect(snapshot?.commitSha).toBe("C".repeat(40));
    expect(snapshot?.refreshError).toBeNull();
    expect(snapshot?.refreshFailedAt).toBeNull();
  });
});

describe("recordSnapshotFailure preservation", () => {
  it("a failed refresh only annotates the last-known-good snapshot", async () => {
    await upsertSnapshotSuccess(successInput("B".repeat(40), t1));
    await recordSnapshotFailure("site-1", "main", "Could not reach GitHub");
    const snapshot = await getSnapshotForSite("site-1");
    // annotation present…
    expect(snapshot?.refreshError).toBe("Could not reach GitHub");
    expect(snapshot?.refreshFailedAt).toBeInstanceOf(Date);
    // …and the good snapshot fully intact
    expect(snapshot?.status).toBe("ready");
    expect(snapshot?.commitSha).toBe("B".repeat(40));
    expect(snapshot?.fileCount).toBe(1);
    expect(snapshot?.fileIndex).toHaveLength(1);
  });

  it("creates an epoch-dated failed placeholder when no snapshot ever succeeded", async () => {
    await recordSnapshotFailure("site-1", "main", "Repository branch not found");
    const snapshot = await getSnapshotForSite("site-1");
    expect(snapshot?.status).toBe("failed");
    expect(snapshot?.commitSha).toBe("");
    expect(snapshot?.fileIndex).toEqual([]);
    expect((snapshot?.indexedAt as Date).getTime()).toBe(0);
  });

  it("any later successful build supersedes the failure placeholder", async () => {
    await recordSnapshotFailure("site-1", "main", "Repository branch not found");
    await upsertSnapshotSuccess(successInput("B".repeat(40), t1));
    const snapshot = await getSnapshotForSite("site-1");
    expect(snapshot?.status).toBe("ready");
    expect(snapshot?.commitSha).toBe("B".repeat(40));
    expect(snapshot?.refreshError).toBeNull();
  });
});
