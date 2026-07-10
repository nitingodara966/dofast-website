import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { getInstallationRecord } from "@/lib/db/installations";
import { refreshSnapshot } from "@/lib/repo/snapshot";
import { readSnapshotFile, type FileReadResult } from "@/lib/repo/files";
import { mintInstallationToken } from "@/lib/github/tokens";
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
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard" className="text-gray-400 text-sm hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="text-3xl font-bold mt-3 mb-1">{site.repoFullName}</h1>
      <p className="text-gray-400 mb-8 text-sm">
        branch: {site.defaultBranch} · read-only file index
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-2xl px-6 py-4 mb-6"
        >
          {errorMessage}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-gray-400">
            {hasIndex ? (
              <>
                Indexed commit{" "}
                <span className="text-white font-mono">
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
            <button
              type="submit"
              className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-white/20 transition"
            >
              Refresh index
            </button>
          </form>
        </div>

        {snapshot?.status === "truncated" && (
          <p className="text-yellow-300/90 text-sm mt-4">
            ⚠ Partial index — this repository is too large to index completely,
            so DoFast only sees part of it.
          </p>
        )}
        {snapshot?.refreshError && snapshot.status !== "failed" && (
          <p className="text-yellow-300/90 text-sm mt-4">
            ⚠ The latest refresh failed ({snapshot.refreshError}). Showing the
            last successful index.
          </p>
        )}
        {(snapshot === null || snapshot.status === "failed") && (
          <p className="text-red-300 text-sm mt-4">
            {snapshot?.refreshError ?? "Indexing failed."} Use Refresh index to
            try again.
          </p>
        )}
      </div>

      {fileView && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold font-mono text-sm truncate">
              {fileView.path}
            </h2>
            <Link
              href={`/sites/${site.id}`}
              className="text-gray-400 text-sm hover:text-white whitespace-nowrap"
            >
              Close
            </Link>
          </div>
          {fileView.result.ok ? (
            <pre className="text-xs text-gray-300 bg-black/40 border border-white/10 rounded-xl p-4 overflow-x-auto max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words">
              {fileView.result.text}
            </pre>
          ) : (
            <p className="text-gray-400 text-sm">
              {readFailureMessages[fileView.result.reason]}
            </p>
          )}
        </div>
      )}

      {hasIndex && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Files</h2>
          {snapshot.fileIndex.length === 0 ? (
            <p className="text-gray-400 text-sm">No indexable files found.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {snapshot.fileIndex.map((file) => (
                <li key={file.p} className="flex items-center gap-3 min-w-0">
                  <Link
                    href={`/sites/${site.id}?path=${encodeURIComponent(file.p)}`}
                    className="text-sm text-gray-300 hover:text-white font-mono truncate"
                  >
                    {file.p}
                  </Link>
                  <span className="text-[10px] text-gray-500 border border-white/10 rounded-full px-2 py-0.5 whitespace-nowrap">
                    {file.r}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
