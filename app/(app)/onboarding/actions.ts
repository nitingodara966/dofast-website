"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";

export async function completeOnboarding() {
  // Server Functions are reachable via direct POST — auth check is mandatory.
  const sessionUser = await requireUser();

  await getDb()
    .update(user)
    .set({ onboardingCompletedAt: new Date() })
    // isNull keeps the original completion time if this is ever re-posted.
    .where(and(eq(user.id, sessionUser.id), isNull(user.onboardingCompletedAt)));

  redirect("/dashboard");
}
