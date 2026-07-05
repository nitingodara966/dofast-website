"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-3">Something went wrong</h1>
      <p className="text-gray-400 mb-8">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
      >
        Try again
      </button>
    </main>
  );
}
