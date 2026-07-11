import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { getInstallationRecord } from "@/lib/db/installations";
import { refreshSnapshot } from "@/lib/repo/snapshot";
import { readSnapshotFile, type FileReadResult } from "@/lib/repo/files";
import { mintInstallationToken } from "@/lib/github/tokens";
import { Alert, Badge, Card } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";
import { refreshSnapshotAction } from "./actions";

export const metadata: Metadata = { title: "Site files — DoFast" };

const errorMessages: Record<string, string> = {
  refresh_rate_limited:
    "You're refreshing too often. Please wait a few minutes and try again.",
};

const readFailureMessages: Record<
  Exclude<FileReadResult, { ok: true; text: string }>["reason"],
  string
> = {
  "not-found": "That file isn't part of the site's index.",
  denied: "That file can't be viewed.",
  "too-large": "That file is too large to view here.",
  binary: "That file looks binary and can't be shown as text.",
  unavailable: "We couldn't fetch that file from GitHub right now. Try again.",
};

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOnboardedUser();
  const { siteId } = await params;
  const site = await getSiteForUser(siteId, user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const installation = await getInstallationRecord(site.installationId);
  if (!installation) redirect("/dashboard");

  const snapshot = await refreshSnapshot(site, installation);

  const query = (await searchParams) ?? {};
  const errorKey = typeof query.error === "string" ? query.error : null;
  const errorMessage = errorKey ? (errorMessages[errorKey] ?? null) : null;
  const requestedPath = typeof query.path === "string" ? query.path : null;

  let fileView: { path: string; result: FileReadResult } | null = null;
  if (requestedPath && snapshot && snapshot.status !== "failed") {
    let result: FileReadResult = { ok: false, reason: "unavailable" };
    try {
      const { token } = await mintInstallationToken(installation);
      result = await readSnapshotFile({
        token,
        repoFullName: site.repoFullName,
        fileIndex: snapshot.fileIndex,
        path: requestedPath,
      });
    } catch {
      // fall through with "unavailable"
    }
    fileView = { path: requestedPath, result };
  }

  const hasIndex = snapshot !== null && snapshot.status !== "failed";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="text-sm text-ink-secondary transition-colors hover:text-ink"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-3 mb-1 font-serif text-2xl font-semibold">
        {site.repoFullName}
      </h1>
      <p className="mb-8 text-sm text-ink-secondary">
        branch: <span className="font-mono">{site.defaultBranch}</span> ·
        read-only file index
      </p>

      {errorMessage && (
        <Alert tone="danger" className="mb-6">
          {errorMessage}
        </Alert>
      )}

      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-ink-secondary">
            {hasIndex ? (
              <>
                Indexed commit{" "}
                <span className="font-mono text-ink">
                  {snapshot.commitSha.slice(0, 7)}
                </span>{" "}
                · {snapshot.fileCount} files · {snapshot.skippedCount} skipped ·{" "}
                {new Date(snapshot.indexedAt).toLocaleString()}
              </>
            ) : (
              <>We couldn&apos;t index this repository yet.</>
            )}
          </div>
          <form action={refreshSnapshotAction}>
            <input type="hidden" name="siteId" value={site.id} />
            <button type="submit" className={buttonClasses("secondary", "sm")}>
              Refresh index
            </button>
          </form>
        </div>

        {snapshot?.status === "truncated" && (
          <Alert tone="warning" className="mt-4">
            Partial index — this repository is too large to index completely,
            so DoFast only sees part of it.
          </Alert>
        )}
        {snapshot?.refreshError && snapshot.status !== "failed" && (
          <Alert tone="warning" className="mt-4">
            The latest refresh failed ({snapshot.refreshError}). Showing the
            last successful index.
          </Alert>
        )}
        {(snapshot === null || snapshot.status === "failed") && (
          <Alert tone="danger" className="mt-4">
            {snapshot?.refreshError ?? "Indexing failed."} Use Refresh index to
            try again.
          </Alert>
        )}
      </Card>

      {fileView && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="truncate font-mono text-sm font-medium">
              {fileView.path}
            </h2>
            <Link
              href={`/sites/${site.id}`}
              className="whitespace-nowrap text-sm text-ink-secondary transition-colors hover:text-ink"
            >
              Close
            </Link>
          </div>
          {fileView.result.ok ? (
            <pre className="max-h-[32rem] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words rounded-control border border-line bg-sunken p-4 font-mono text-xs text-ink">
              {fileView.result.text}
            </pre>
          ) : (
            <p className="text-sm text-ink-secondary">
              {readFailureMessages[fileView.result.reason]}
            </p>
          )}
        </Card>
      )}

      {hasIndex && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Files</h2>
          {snapshot.fileIndex.length === 0 ? (
            <p className="text-sm text-ink-secondary">No indexable files found.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {snapshot.fileIndex.map((file) => (
                <li key={file.p} className="flex min-w-0 items-center gap-3">
                  <Link
                    href={`/sites/${site.id}?path=${encodeURIComponent(file.p)}`}
                    className="truncate font-mono text-sm text-ink-secondary transition-colors hover:text-ink"
                  >
                    {file.p}
                  </Link>
                  <Badge>{file.r}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
