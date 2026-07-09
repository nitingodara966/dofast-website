import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";

export const metadata: Metadata = { title: "Dashboard — DoFast" };

const errorMessages: Record<string, string> = {
  github_setup_failed:
    "We couldn't complete the GitHub connection. Please try again.",
  installation_unavailable:
    "That GitHub installation is already connected to another DoFast account.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOnboardedUser();
  const installations = await listInstallationsForUser(user.id);
  const active = installations.find((i) => !i.revokedAt) ?? null;
  const wasDisconnected = !active && installations.length > 0;

  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-10">
        Your connected websites will live here.
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-2xl px-6 py-4 mb-6"
        >
          {errorMessage}
        </div>
      )}

      {active && !active.suspendedAt && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold mb-1">GitHub connected</h2>
              <p className="text-gray-400 text-sm">
                Connected as{" "}
                <span className="text-white">{active.accountLogin}</span> (
                {active.accountType}) —{" "}
                {active.repositorySelection === "all"
                  ? "all repositories"
                  : "selected repositories"}
              </p>
            </div>
            <span className="bg-green-500/15 border border-green-500/30 text-green-300 text-xs px-3 py-1.5 rounded-full">
              Connected
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-6">
            Next step: choose the repository that powers your website.
            Repository selection is coming in the next update.
          </p>
        </div>
      )}

      {active?.suspendedAt && (
        <div className="bg-white/5 border border-yellow-500/30 rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-1">
            GitHub connection suspended
          </h2>
          <p className="text-gray-400 text-sm">
            The DoFast installation for{" "}
            <span className="text-white">{active.accountLogin}</span> is
            suspended on GitHub. Unsuspend it from your GitHub settings to
            continue.
          </p>
        </div>
      )}

      {!active && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">🌐</div>
          <h2 className="text-xl font-semibold mb-2">
            No websites connected yet
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            {wasDisconnected
              ? "Your previous GitHub connection was removed. Reconnect to continue updating your site by chatting with AI."
              : "Connect your GitHub account to start updating your website by chatting with AI."}
          </p>
          <a
            href="/api/github/install"
            className="inline-block bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
          >
            Connect GitHub
          </a>
        </div>
      )}
    </div>
  );
}
