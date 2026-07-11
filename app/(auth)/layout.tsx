import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 font-serif text-xl font-semibold">
        DoFast
      </Link>
      {children}
    </main>
  );
}
