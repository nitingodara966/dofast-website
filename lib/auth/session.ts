import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./index";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function getUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
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
