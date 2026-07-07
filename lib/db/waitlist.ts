import "server-only";
import { getDb } from "./index";
import { waitlistSignups } from "./schema";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Insert a waitlist signup, deduplicating on email. Concurrency-safe: the
 * unique constraint plus ON CONFLICT DO NOTHING makes the insert atomic.
 *
 * @returns created=true when a new row was inserted, false for duplicates.
 */
export async function addWaitlistSignup(
  email: string,
  source = "landing_page"
): Promise<{ created: boolean }> {
  const rows = await getDb()
    .insert(waitlistSignups)
    .values({ email: normalizeEmail(email), source })
    .onConflictDoNothing({ target: waitlistSignups.email })
    .returning({ id: waitlistSignups.id });

  return { created: rows.length > 0 };
}
