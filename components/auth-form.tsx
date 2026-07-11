"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/surfaces";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-card border border-line bg-surface p-8">
      <h1 className="font-serif text-2xl font-semibold mb-1">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="text-sm text-ink-secondary mb-6">
        {mode === "signup"
          ? "Start updating your website by asking."
          : "Sign in to your DoFast account."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <TextField
            label="Your name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        )}
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          help={mode === "signup" ? "At least 8 characters." : undefined}
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" loading={pending}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-accent-strong hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to DoFast?{" "}
            <Link href="/signup" className="text-accent-strong hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
