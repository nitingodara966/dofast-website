import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in — DoFast" };

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
