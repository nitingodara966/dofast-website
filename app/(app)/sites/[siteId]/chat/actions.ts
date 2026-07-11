"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import {
  addMessage,
  createThread,
  getThreadForUser,
  touchThread,
} from "@/lib/db/chat";
import { generateAssistantReply } from "@/lib/chat/responder";
import { checkRateLimit } from "@/lib/rate-limit";

const messageSchema = z.string().trim().min(1).max(4000);

export async function createThreadAction(formData: FormData) {
  const user = await requireOnboardedUser();

  // Ownership first; the site id is only used in redirects once verified.
  const site = await getSiteForUser(String(formData.get("siteId") ?? ""), user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const rate = checkRateLimit(`chat-thread:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) redirect(`/sites/${site.id}/chat?error=rate_limited`);

  const thread = await createThread(site.id, user.id);
  redirect(`/sites/${site.id}/chat/${thread.id}`);
}

export async function sendMessageAction(formData: FormData) {
  const user = await requireOnboardedUser();

  const thread = await getThreadForUser(
    String(formData.get("threadId") ?? ""),
    user.id
  );
  if (!thread) redirect("/dashboard");
  const site = await getSiteForUser(thread.siteId, user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const base = `/sites/${site.id}/chat/${thread.id}`;

  const rate = checkRateLimit(`chat-send:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) redirect(`${base}?error=rate_limited`);

  const parsed = messageSchema.safeParse(formData.get("message"));
  if (!parsed.success) redirect(`${base}?error=invalid_message`);
  const content = parsed.data;

  await addMessage(thread.id, "user", content);
  const reply = await generateAssistantReply({
    siteName: site.repoFullName,
    userMessage: content,
  });
  await addMessage(thread.id, "assistant", reply);
  await touchThread(
    thread.id,
    thread.title === "New chat" ? content.slice(0, 60) : undefined
  );

  redirect(base);
}
