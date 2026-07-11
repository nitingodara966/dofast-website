import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { getThreadForUser, listMessagesForThread } from "@/lib/db/chat";
import { Alert } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";
import { sendMessageAction } from "../actions";

export const metadata: Metadata = { title: "Chat — DoFast" };

const errorMessages: Record<string, string> = {
  rate_limited: "You're sending messages a little too fast. Please wait a minute.",
  invalid_message: "Messages must be between 1 and 4,000 characters.",
};

export default async function ChatThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; threadId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteId, threadId } = await params;
  const user = await requireOnboardedUser();

  const thread = await getThreadForUser(threadId, user.id);
  if (!thread || thread.siteId !== siteId) redirect("/dashboard");
  const site = await getSiteForUser(thread.siteId, user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const messages = await listMessagesForThread(thread.id);
  const query = (await searchParams) ?? {};
  const errorKey = typeof query.error === "string" ? query.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm text-ink-tertiary">
        <Link
          href={`/sites/${site.id}/chat`}
          className="transition-colors hover:text-ink"
        >
          ← All chats
        </Link>{" "}
        · {site.repoFullName}
      </p>
      <h1 className="mb-8 truncate font-serif text-xl font-medium">
        {thread.title}
      </h1>

      <div className="mb-8 flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-secondary">
            Say hello — tell DoFast what you&apos;d like to change on your site.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "max-w-[85%] self-end rounded-card rounded-br-sm bg-ink px-4 py-3 text-paper"
                : "max-w-[85%] self-start rounded-card rounded-bl-sm border border-line bg-surface px-4 py-3"
            }
          >
            <p className="whitespace-pre-wrap break-words text-body">
              {message.content}
            </p>
          </div>
        ))}
      </div>

      {errorMessage && (
        <Alert tone="danger" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form action={sendMessageAction} className="flex gap-3">
        <input type="hidden" name="threadId" value={thread.id} />
        <input
          type="text"
          name="message"
          aria-label="Your message"
          placeholder="What would you like to change?"
          required
          maxLength={4000}
          autoComplete="off"
          className="h-11 flex-1 rounded-control border border-line-strong bg-surface px-4 text-body text-ink placeholder:text-ink-tertiary focus:outline-none"
        />
        <button type="submit" className={buttonClasses("primary", "md")}>
          Send
        </button>
      </form>
    </div>
  );
}
