import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account — DoFast" };

export default async function SignupPage() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="signup" />;
}
