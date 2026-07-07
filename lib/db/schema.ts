import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const waitlistSignups = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored normalized (trimmed + lowercased); uniqueness relies on it.
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("landing_page"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Plain text until the auth tables land in Milestone 2.
  userId: text("user_id"),
  siteId: text("site_id"),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
