import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";
import { listSitesForUser } from "@/lib/db/sites";
import { mintInstallationToken } from "@/lib/github/tokens";
import { listInstallationRepositories, type RepoSummary } from "@/lib/github/repos";
import { Alert, Badge } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";
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
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold mb-2">
        Choose your repository
      </h1>
      <p className="text-ink-secondary mb-8">
        Pick the GitHub repository that powers your website. DoFast supports
        Next.js and React sites.
      </p>

      {errorMessage && (
        <Alert tone="danger" className="mb-6">
          {errorMessage}
        </Alert>
      )}

      {active.suspendedAt && (
        <p className="text-ink-secondary">
          Your GitHub installation is suspended. Unsuspend it from your GitHub
          settings to choose a repository.
        </p>
      )}

      {!active.suspendedAt && repos === null && (
        <p className="text-ink-secondary">
          We couldn&apos;t load your repositories from GitHub. Please refresh to
          try again.
        </p>
      )}

      {repos !== null && repos.length === 0 && (
        <p className="text-ink-secondary">
          Your installation doesn&apos;t grant access to any repositories yet.
          Grant access from your GitHub installation settings, then refresh.
        </p>
      )}

      {repos !== null && repos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {repos.map((repo) => (
            <li
              key={repo.id}
              className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate font-mono text-sm">{repo.fullName}</span>
                  {repo.private && <Badge>private</Badge>}
                  {repo.archived && <Badge tone="warning">archived</Badge>}
                </p>
                <p className="mt-1 text-sm text-ink-tertiary">
                  default branch: {repo.defaultBranch}
                </p>
              </div>
              {connectedRepoIds.has(repo.id) ? (
                <Badge tone="success">Connected</Badge>
              ) : (
                <form action={selectRepository}>
                  <input type="hidden" name="repoId" value={repo.id} />
                  <button type="submit" className={buttonClasses("primary", "sm")}>
                    Connect
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
