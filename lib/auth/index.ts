import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "../db";
import * as schema from "../db/schema";

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

// Reuse across hot reloads / invocations on the same instance.
const globalForAuth = globalThis as unknown as { dofastAuth?: Auth };

/**
 * Lazily initialized (like getDb) so importing this module never requires
 * env vars at build time.
 */
export function getAuth(): Auth {
  if (!globalForAuth.dofastAuth) {
    globalForAuth.dofastAuth = createAuth();
  }
  return globalForAuth.dofastAuth;
}
