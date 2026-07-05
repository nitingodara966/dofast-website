import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-3">Page not found</h1>
      <p className="text-gray-400 mb-8">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
      >
        Back to DoFast
      </Link>
    </main>
  );
}
