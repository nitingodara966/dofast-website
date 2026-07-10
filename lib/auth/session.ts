import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./index";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  onboardingCompletedAt: Date | null;
};

export async function getUser(): Promise<SessionUser | null> {
  // headers() must be awaited BEFORE getAuth(): during build-time
  // prerendering it bails the route out to dynamic rendering, so auth (and
  // its database client) is never initialized in environments without env
  // vars — e.g. the env-less CI build. getAuth() first would call getDb()
  // eagerly and crash `next build` wherever DATABASE_URL is absent.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  });
  if (!session) return null;
  const { id, email, name } = session.user;
  const { onboardingCompletedAt } = session.user as {
    onboardingCompletedAt?: Date | null;
  };
  return { id, email, name, onboardingCompletedAt: onboardingCompletedAt ?? null };
}

/**
 * The real auth check for protected routes — the proxy redirect is
 * optimistic UX only. Every protected layout/page/handler goes through here.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages that also require completed onboarding (dashboard and everything
 * that will grow around it).
 */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  return user;
}
