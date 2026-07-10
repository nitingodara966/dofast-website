"use server";

import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listInstallationsForUser } from "@/lib/db/installations";
import { createSite } from "@/lib/db/sites";
import { writeAudit } from "@/lib/db/audit";
import { mintInstallationToken } from "@/lib/github/tokens";
import { getInstallationRepository, fetchRepoPackageJson } from "@/lib/github/repos";
import { detectFramework } from "@/lib/github/detect";

export async function selectRepository(formData: FormData) {
  // Server Functions are reachable via direct POST — full auth + ownership
  // checks run here regardless of what the UI showed.
  const user = await requireOnboardedUser();

  const repoIdRaw = String(formData.get("repoId") ?? "");
  if (!/^\d{1,15}$/.test(repoIdRaw)) {
    redirect("/repositories?error=invalid_repository");
  }
  const repoId = Number(repoIdRaw);

  const installations = await listInstallationsForUser(user.id);
  const active = installations.find((i) => !i.revokedAt && !i.suspendedAt);
  if (!active) redirect("/dashboard?error=github_setup_failed");

  let token = "";
  try {
    token = (
      await mintInstallationToken({
        installationId: active.installationId,
        suspendedAt: active.suspendedAt,
        revokedAt: active.revokedAt,
      })
    ).token;
  } catch (error) {
    console.error("sites: token mint failed during repository selection", error);
  }
  if (!token) redirect("/repositories?error=github_unavailable");

  // Installation tokens only see granted repos — a 404 means this repo is
  // not accessible through the user's own installation.
  let repo;
  try {
    repo = await getInstallationRepository(token, repoId);
  } catch {
    redirect("/repositories?error=github_unavailable");
  }
  if (!repo) redirect("/repositories?error=repository_unavailable");

  let packageJson: string | null = null;
  try {
    packageJson = await fetchRepoPackageJson(token, repo.fullName);
  } catch {
    redirect("/repositories?error=github_unavailable");
  }
  const framework = detectFramework(packageJson);
  if (!framework) redirect("/repositories?error=unsupported_repository");

  const result = await createSite({
    userId: user.id,
    installationId: active.installationId,
    repoId,
    repoFullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    framework,
  });

  await writeAudit({
    action: "site.connected",
    userId: user.id,
    detail: { repoId, repoFullName: repo.fullName, framework, result },
  });

  redirect(
    result === "created" ? "/dashboard" : "/dashboard?notice=already_connected"
  );
}
