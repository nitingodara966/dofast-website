import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed by commands that touch a real database (migrate/push/studio).
    url: process.env.DATABASE_URL ?? "",
  },
});
