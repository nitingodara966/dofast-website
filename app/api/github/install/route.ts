import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { getGitHubAppConfig } from "@/lib/github/config";
import { createStateToken, GITHUB_STATE_COOKIE } from "@/lib/github/state";
import { checkRateLimit } from "@/lib/rate-limit";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Starts the GitHub App installation flow: binds a signed, expiring state to
 * the signed-in user (cookie + install URL) and redirects to GitHub. The only
 * redirect target is the official install URL derived from GITHUB_APP_SLUG.
 */
export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`github-install:${clientIp(request)}`, {
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

  let slug: string;
  let state: string;
  try {
    slug = getGitHubAppConfig().slug;
    state = createStateToken(user.id);
  } catch (error) {
    console.error("github: install start failed", error);
    return Response.json(
      { error: "GitHub connection is not available right now." },
      { status: 500 }
    );
  }

  const installUrl = new URL(`https://github.com/apps/${slug}/installations/new`);
  installUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(installUrl);
  res.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/github",
  });
  return res;
}
