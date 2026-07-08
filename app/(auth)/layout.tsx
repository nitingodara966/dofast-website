import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="text-2xl font-bold mb-8">
        DoFast
      </Link>
      {children}
    </main>
  );
}
