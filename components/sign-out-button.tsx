"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="bg-white/10 border border-white/20 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/20 transition"
    >
      Sign out
    </button>
  );
}
