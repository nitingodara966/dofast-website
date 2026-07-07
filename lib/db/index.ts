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

  try {
    const parsedUrl = new URL(url);
    console.log("DB DEBUG:", {
      host: parsedUrl.hostname,
      user: parsedUrl.username,
      database: parsedUrl.pathname,
    });
  } catch {
    console.log("DB DEBUG: unable to parse DATABASE_URL");
  }
  // prepare: false is required for Supabase's transaction-mode pooler.
  const client = postgres(url, { prepare: false });
  globalForDb.dofastDb = drizzle(client, { schema });
  return globalForDb.dofastDb;
}
