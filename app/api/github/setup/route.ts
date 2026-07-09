import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { getInstallation } from "@/lib/github/app";
import {
  GITHUB_STATE_COOKIE,
  safeEqual,
  verifyStateToken,
} from "@/lib/github/state";
import { claimInstallation } from "@/lib/db/installations";
import { writeAudit } from "@/lib/db/audit";
import { checkRateLimit } from "@/lib/rate-limit";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * GitHub redirects the installing user here with ?installation_id=&state=.
 * Nothing from the query is trusted: the state must match the signed cookie
 * bound to this user, and installation metadata is fetched from GitHub with
 * App credentials before anything is stored. All exits redirect to fixed
 * internal paths and clear the state cookie.
 */
export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`github-setup:${clientIp(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const user = await getUser();
  if (!user) redirect("/login");

  const fail = (reason: string) => {
    console.warn(`github: setup callback rejected (${reason})`);
    return finish("/dashboard?error=github_setup_failed");
  };
  const finish = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    res.cookies.set(GITHUB_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/api/github",
    });
    return res;
  };

  const params = request.nextUrl.searchParams;
  const stateParam = params.get("state") ?? "";
  const cookieState = request.cookies.get(GITHUB_STATE_COOKIE)?.value ?? "";
  if (!stateParam || !cookieState) return fail("missing state");
  if (!safeEqual(stateParam, cookieState)) return fail("state mismatch");
  if (!verifyStateToken(cookieState, user.id)) return fail("invalid state");

  const idRaw = params.get("installation_id") ?? "";
  if (!/^\d{1,15}$/.test(idRaw)) return fail("invalid installation_id");
  const installationId = Number(idRaw);

  let info;
  try {
    info = await getInstallation(installationId);
  } catch {
    return fail("github verification failed");
  }
  if (!info) return fail("installation not found");

  let result;
  try {
    result = await claimInstallation({
      userId: user.id,
      installationId,
      accountLogin: info.accountLogin,
      accountType: info.accountType,
      repositorySelection: info.repositorySelection,
      permissions: info.permissions,
      suspendedAt: info.suspendedAt ? new Date(info.suspendedAt) : null,
    });
  } catch (error) {
    console.error("github: installation claim failed", error);
    return fail("claim failed");
  }

  if (result === "owned-by-other") {
    await writeAudit({
      action: "github.installation.claim_conflict",
      userId: user.id,
      detail: { installationId },
    });
    return finish("/dashboard?error=installation_unavailable");
  }

  await writeAudit({
    action:
      result === "claimed"
        ? "github.installation.connected"
        : "github.installation.reconfirmed",
    userId: user.id,
    detail: { installationId, accountLogin: info.accountLogin },
  });
  return finish("/dashboard");
}
