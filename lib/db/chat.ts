import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { chatMessages, chatThreads } from "./schema";

export type ThreadRecord = typeof chatThreads.$inferSelect;
export type MessageRecord = typeof chatMessages.$inferSelect;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createThread(
  siteId: string,
  userId: string
): Promise<ThreadRecord> {
  const [row] = await getDb()
    .insert(chatThreads)
    .values({ siteId, userId })
    .returning();
  return row;
}

/** Ownership-scoped lookup — the only way callers resolve a thread by id. */
export async function getThreadForUser(
  threadId: string,
  userId: string
): Promise<ThreadRecord | null> {
  if (!UUID_RE.test(threadId)) return null;
  const rows = await getDb()
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  return rows[0] ?? null;
}

export async function listThreadsForSite(
  siteId: string,
  userId: string
): Promise<ThreadRecord[]> {
  return getDb()
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.siteId, siteId), eq(chatThreads.userId, userId)))
    .orderBy(desc(chatThreads.updatedAt));
}

/** Callers must have resolved the thread via getThreadForUser first. */
export async function listMessagesForThread(
  threadId: string
): Promise<MessageRecord[]> {
  return getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function addMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string
): Promise<MessageRecord> {
  const [row] = await getDb()
    .insert(chatMessages)
    .values({ threadId, role, content })
    .returning();
  return row;
}

export async function touchThread(
  threadId: string,
  title?: string
): Promise<void> {
  await getDb()
    .update(chatThreads)
    .set({ updatedAt: new Date(), ...(title ? { title } : {}) })
    .where(eq(chatThreads.id, threadId));
}
