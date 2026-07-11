import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { listThreadsForSite } from "@/lib/db/chat";
import { Alert, Card } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold">Chat</h1>
        <form action={createThreadAction}>
          <input type="hidden" name="siteId" value={site.id} />
          <button type="submit" className={buttonClasses("primary", "sm")}>
            New chat
          </button>
        </form>
      </div>
      <p className="mb-8 text-ink-secondary">
        {site.repoFullName} ·{" "}
        <Link
          href={`/sites/${site.id}`}
          className="transition-colors hover:text-ink"
        >
          view files
        </Link>
      </p>

      {errorMessage && (
        <Alert tone="danger" className="mb-6">
          {errorMessage}
        </Alert>
      )}

      {threads.length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="mb-2 font-serif text-xl font-medium">No chats yet</h2>
          <p className="mx-auto max-w-md text-sm text-ink-secondary">
            Start a chat about your website. AI-powered editing arrives in the
            next update — your conversations are saved either way.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/sites/${site.id}/chat/${thread.id}`}
              className="rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong hover:bg-sunken"
            >
              <p className="truncate font-medium">{thread.title}</p>
              <p className="mt-1 text-sm text-ink-tertiary">
                last activity {thread.updatedAt.toLocaleString("en-US")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
