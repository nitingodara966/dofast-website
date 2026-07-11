import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";
import { listSitesForUser } from "@/lib/db/sites";
import { Alert, Badge, Card } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";

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
      <h1 className="font-serif text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-ink-secondary mb-10">
        Your connected websites will live here.
      </p>

      {errorMessage && (
        <Alert tone="danger" className="mb-6">
          {errorMessage}
        </Alert>
      )}
      {noticeMessage && (
        <Alert tone="neutral" className="mb-6">
          {noticeMessage}
        </Alert>
      )}

      {active && !active.suspendedAt && (
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">GitHub connected</h2>
              <p className="text-sm text-ink-secondary">
                Connected as <span className="text-ink">{active.accountLogin}</span>{" "}
                ({active.accountType}) —{" "}
                {active.repositorySelection === "all"
                  ? "all repositories"
                  : "selected repositories"}
              </p>
            </div>
            <Badge tone="success">Connected</Badge>
          </div>

          {activeSites.length === 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink-secondary">
                Next step: choose the repository that powers your website.
              </p>
              <Link href="/repositories" className={buttonClasses("primary", "sm")}>
                Choose repository
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {activeSites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-paper px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{site.repoFullName}</p>
                    <p className="mt-1 text-sm text-ink-tertiary">
                      {frameworkLabels[site.framework] ?? site.framework} ·
                      branch: {site.defaultBranch}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <Link
                      href={`/sites/${site.id}`}
                      className="text-sm text-ink-secondary transition-colors hover:text-ink"
                    >
                      View files
                    </Link>
                    <Link
                      href={`/sites/${site.id}/chat`}
                      className={buttonClasses("primary", "sm")}
                    >
                      Open chat
                    </Link>
                  </div>
                </div>
              ))}
              <Link
                href="/repositories"
                className="mt-1 self-start text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                + Connect another repository
              </Link>
            </div>
          )}
        </Card>
      )}

      {active?.suspendedAt && (
        <Card className="border-warning/25 p-6">
          <h2 className="text-lg font-semibold mb-1">
            GitHub connection suspended
          </h2>
          <p className="text-sm text-ink-secondary">
            The DoFast installation for{" "}
            <span className="text-ink">{active.accountLogin}</span> is suspended
            on GitHub. Unsuspend it from your GitHub settings to continue.
          </p>
        </Card>
      )}

      {!active && (
        <Card className="p-12 text-center">
          <h2 className="font-serif text-xl font-medium mb-2">
            No websites connected yet
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-ink-secondary">
            {wasDisconnected
              ? "Your previous GitHub connection was removed. Reconnect to continue updating your site by chatting with AI."
              : "Connect your GitHub account to start updating your website by chatting with AI."}
          </p>
          <a href="/api/github/install" className={buttonClasses("primary", "md")}>
            Connect GitHub
          </a>
        </Card>
      )}
    </div>
  );
}
