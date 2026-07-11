import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif font-semibold text-2xl mb-3">Page not found</h1>
      <p className="text-ink-secondary mb-8">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="bg-accent text-white px-5 py-2 rounded-control font-medium hover:bg-accent-strong transition-colors"
      >
        Back to DoFast
      </Link>
    </main>
  );
}
