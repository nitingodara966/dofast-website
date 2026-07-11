import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { listThreadsForSite } from "@/lib/db/chat";
import { createThreadAction } from "./actions";

export const metadata: Metadata = { title: "Chat — DoFast" };

const errorMessages: Record<string, string> = {
  rate_limited: "You're doing that a little too fast. Please wait a minute.",
};

export default async function ChatThreadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteId } = await params;
  const user = await requireOnboardedUser();
  const site = await getSiteForUser(siteId, user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const threads = await listThreadsForSite(site.id, user.id);
  const query = (await searchParams) ?? {};
  const errorKey = typeof query.error === "string" ? query.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 className="text-3xl font-bold">Chat</h1>
        <form action={createThreadAction}>
          <input type="hidden" name="siteId" value={site.id} />
          <button
            type="submit"
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition"
          >
            New chat
          </button>
        </form>
      </div>
      <p className="text-gray-400 mb-8">
        {site.repoFullName} ·{" "}
        <Link href={`/sites/${site.id}`} className="hover:text-white transition">
          view files
        </Link>
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-2xl px-6 py-4 mb-6"
        >
          {errorMessage}
        </div>
      )}

      {threads.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">💬</div>
          <h2 className="text-xl font-semibold mb-2">No chats yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Start a chat about your website. AI-powered editing arrives in the
            next update — your conversations are saved either way.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/sites/${site.id}/chat/${thread.id}`}
              className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 hover:bg-white/10 transition"
            >
              <p className="font-semibold truncate">{thread.title}</p>
              <p className="text-gray-500 text-xs mt-1">
                last activity {thread.updatedAt.toLocaleString("en-US")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
