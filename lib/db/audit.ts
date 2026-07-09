import "server-only";
import { getDb } from "./index";
import { auditLog } from "./schema";

/**
 * Best-effort audit trail — an audit failure must never break the operation
 * being audited (webhooks especially). Detail must never contain secrets.
 */
export async function writeAudit(entry: {
  action: string;
  userId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().insert(auditLog).values({
      action: entry.action,
      userId: entry.userId ?? null,
      detail: entry.detail ?? null,
    });
  } catch (error) {
    console.error(`audit: failed to record ${entry.action}`, error);
  }
}
