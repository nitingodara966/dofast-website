"use server";

import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getSiteForUser } from "@/lib/db/sites";
import { getInstallationRecord } from "@/lib/db/installations";
import { refreshSnapshot } from "@/lib/repo/snapshot";
import { checkRateLimit } from "@/lib/rate-limit";

export async function refreshSnapshotAction(formData: FormData) {
  const user = await requireOnboardedUser();

  const siteId = String(formData.get("siteId") ?? "");
  const site = await getSiteForUser(siteId, user.id);
  if (!site || site.status !== "active") redirect("/dashboard");

  const rate = checkRateLimit(`snapshot-refresh:${user.id}:${site.id}`, {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    redirect(`/sites/${site.id}?error=refresh_rate_limited`);
  }

  const installation = await getInstallationRecord(site.installationId);
  if (installation) {
    await refreshSnapshot(site, installation, { force: true });
  }
  redirect(`/sites/${site.id}`);
}
