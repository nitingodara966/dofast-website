import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";
import { listSitesForUser } from "@/lib/db/sites";
import { mintInstallationToken } from "@/lib/github/tokens";
import { listInstallationRepositories, type RepoSummary } from "@/lib/github/repos";
import { selectRepository } from "./actions";

export const metadata: Metadata = { title: "Choose repository — DoFast" };

const errorMessages: Record<string, string> = {
  invalid_repository: "That repository selection was not valid. Please try again.",
  repository_unavailable:
    "That repository isn't accessible through your GitHub installation.",
  unsupported_repository:
    "DoFast currently supports Next.js and React websites. That repository doesn't look like one yet.",
  github_unavailable:
    "We couldn't reach GitHub just now. Please try again in a moment.",
};

export default async function RepositoriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOnboardedUser();

  const installations = await listInstallationsForUser(user.id);
  const active = installations.find((i) => !i.revokedAt) ?? null;
  if (!active) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;

  let repos: RepoSummary[] | null = null;
  if (!active.suspendedAt) {
    try {
      const { token } = await mintInstallationToken({
        installationId: active.installationId,
        suspendedAt: active.suspendedAt,
        revokedAt: active.revokedAt,
      });
      repos = await listInstallationRepositories(token);
    } catch (error) {
      console.error("sites: repository listing failed", error);
    }
  }

  const sitesList = await listSitesForUser(user.id);
  const connectedRepoIds = new Set(
    sitesList.filter((s) => s.status === "active").map((s) => s.repoId)
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Choose your repository</h1>
      <p className="text-gray-400 mb-8">
        Pick the GitHub repository that powers your website. DoFast supports
        Next.js and React sites.
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-2xl px-6 py-4 mb-6"
        >
          {errorMessage}
        </div>
      )}

      {active.suspendedAt && (
        <p className="text-gray-400">
          Your GitHub installation is suspended. Unsuspend it from your GitHub
          settings to choose a repository.
        </p>
      )}

      {!active.suspendedAt && repos === null && (
        <p className="text-gray-400">
          We couldn&apos;t load your repositories from GitHub. Please refresh to
          try again.
        </p>
      )}

      {repos !== null && repos.length === 0 && (
        <p className="text-gray-400">
          Your installation doesn&apos;t grant access to any repositories yet.
          Grant access from your GitHub installation settings, then refresh.
        </p>
      )}

      {repos !== null && repos.length > 0 && (
        <div className="flex flex-col gap-3">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {repo.fullName}
                  {repo.private && (
                    <span className="ml-2 text-xs text-gray-400 border border-white/20 rounded-full px-2 py-0.5">
                      private
                    </span>
                  )}
                  {repo.archived && (
                    <span className="ml-2 text-xs text-yellow-300/80 border border-yellow-500/30 rounded-full px-2 py-0.5">
                      archived
                    </span>
                  )}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  default branch: {repo.defaultBranch}
                </p>
              </div>
              {connectedRepoIds.has(repo.id) ? (
                <span className="bg-green-500/15 border border-green-500/30 text-green-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
                  Connected
                </span>
              ) : (
                <form action={selectRepository}>
                  <input type="hidden" name="repoId" value={repo.id} />
                  <button
                    type="submit"
                    className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition whitespace-nowrap"
                  >
                    Connect
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
