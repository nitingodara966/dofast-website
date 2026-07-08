"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

const inputClass =
  "w-full px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white";

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
    <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8">
      <h1 className="text-2xl font-bold mb-1">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        {mode === "signup"
          ? "Start updating your website by chatting with AI."
          : "Sign in to your DoFast account."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        )}
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />

        {error && (
          <p role="alert" className="text-red-400 text-sm px-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition disabled:opacity-60"
        >
          {pending
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="text-gray-500 text-sm mt-6 text-center">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-white hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to DoFast?{" "}
            <Link href="/signup" className="text-white hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
