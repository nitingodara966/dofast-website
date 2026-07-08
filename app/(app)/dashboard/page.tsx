import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — DoFast" };

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-10">
        Your connected websites will live here.
      </p>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-4">🌐</div>
        <h2 className="text-xl font-semibold mb-2">No websites connected yet</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
          Connect your first website to start updating it by chatting with AI.
          GitHub connection is coming in the next update.
        </p>
        <button
          disabled
          title="Coming soon"
          className="bg-white/15 text-white/50 px-6 py-3 rounded-full font-semibold cursor-not-allowed"
        >
          Connect Website — coming soon
        </button>
      </div>
    </div>
  );
}
