import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto border-b border-white/10">
        <Link href="/dashboard" className="text-2xl font-bold">
          DoFast
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-8 py-10">{children}</main>
    </div>
  );
}
