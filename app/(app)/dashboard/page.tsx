import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";
import { listSitesForUser } from "@/lib/db/sites";

export const metadata: Metadata = { title: "Dashboard — DoFast" };

const errorMessages: Record<string, string> = {
  github_setup_failed:
    "We couldn't complete the GitHub connection. Please try again.",
  installation_unavailable:
    "That GitHub installation is already connected to another DoFast account.",
};

const noticeMessages: Record<string, string> = {
  already_connected: "That repository is already connected.",
};

const frameworkLabels: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
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
  const allSites = await listSitesForUser(user.id);
  const activeSites = allSites.filter((s) => s.status === "active");

  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;
  const noticeKey = typeof params.notice === "string" ? params.notice : null;
  const noticeMessage = noticeKey ? (noticeMessages[noticeKey] ?? null) : null;

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

      {noticeMessage && (
        <div className="bg-white/5 border border-white/20 text-gray-300 text-sm rounded-2xl px-6 py-4 mb-6">
          {noticeMessage}
        </div>
      )}

      {active && !active.suspendedAt && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
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

          {activeSites.length === 0 ? (
            <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-gray-400 text-sm">
                Next step: choose the repository that powers your website.
              </p>
              <Link
                href="/repositories"
                className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition whitespace-nowrap"
              >
                Choose repository
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {activeSites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{site.repoFullName}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {frameworkLabels[site.framework] ?? site.framework} ·
                      branch: {site.defaultBranch}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    <Link
                      href={`/sites/${site.id}`}
                      className="text-sm text-gray-300 hover:text-white transition"
                    >
                      View files
                    </Link>
                    <span className="text-gray-500 text-xs">
                      Chat — coming next
                    </span>
                  </div>
                </div>
              ))}
              <Link
                href="/repositories"
                className="text-gray-400 text-sm hover:text-white transition self-start mt-1"
              >
                + Connect another repository
              </Link>
            </div>
          )}
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
