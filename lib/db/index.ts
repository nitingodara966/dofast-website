import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// Reuse the connection across hot reloads / invocations on the same instance.
const globalForDb = globalThis as unknown as { dofastDb?: Db };

/**
 * Lazily initialized so importing this module never requires DATABASE_URL
 * (e.g. during `next build`). Callers get a clear error at request time
 * if the environment is misconfigured.
 */
export function getDb(): Db {
  if (globalForDb.dofastDb) return globalForDb.dofastDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // prepare: false is required for Supabase's transaction-mode pooler.
  const client = postgres(url, { prepare: false });
  globalForDb.dofastDb = drizzle(client, { schema });
  return globalForDb.dofastDb;
}
