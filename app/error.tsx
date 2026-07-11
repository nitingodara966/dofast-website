"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif font-semibold text-2xl mb-3">
        Something went wrong
      </h1>
      <p className="text-ink-secondary mb-8">
        An unexpected error occurred on our side. Please try again.
      </p>
      <button
        onClick={reset}
        className="bg-accent text-white px-5 py-2 rounded-control font-medium hover:bg-accent-strong transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
