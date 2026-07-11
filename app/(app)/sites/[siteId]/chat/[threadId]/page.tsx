import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { getThreadForUser, listMessagesForThread } from "@/lib/db/chat";
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
    <div className="max-w-3xl mx-auto">
      <p className="text-gray-500 text-sm mb-2">
        <Link
          href={`/sites/${site.id}/chat`}
          className="hover:text-white transition"
        >
          ← All chats
        </Link>{" "}
        · {site.repoFullName}
      </p>
      <h1 className="text-2xl font-bold mb-8 truncate">{thread.title}</h1>

      <div className="flex flex-col gap-4 mb-8">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Say hello — tell DoFast what you&apos;d like to change on your site.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "self-end max-w-[85%] bg-white text-black rounded-2xl rounded-br-sm px-5 py-3"
                : "self-start max-w-[85%] bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-5 py-3"
            }
          >
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-2xl px-6 py-4 mb-4"
        >
          {errorMessage}
        </div>
      )}

      <form action={sendMessageAction} className="flex gap-3">
        <input type="hidden" name="threadId" value={thread.id} />
        <input
          type="text"
          name="message"
          placeholder="Describe the change you want…"
          required
          maxLength={4000}
          autoComplete="off"
          className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white"
        />
        <button
          type="submit"
          className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
