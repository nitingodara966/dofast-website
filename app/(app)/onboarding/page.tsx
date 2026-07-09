import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { completeOnboarding } from "./actions";

export const metadata: Metadata = { title: "Welcome — DoFast" };

const steps = [
  {
    step: "1",
    title: "Connect your website",
    desc: "Link the GitHub repository that powers your site. GitHub is our first supported integration — connect it from your dashboard.",
    badge: "GitHub — first integration",
  },
  {
    step: "2",
    title: "Chat your changes",
    desc: 'Tell DoFast what to change in plain English — "Update our contact email" or "Add a new team member".',
  },
  {
    step: "3",
    title: "Preview, then publish",
    desc: "Every change shows you a preview first. Nothing goes live until you approve it.",
  },
];

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingCompletedAt) redirect("/dashboard");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        Welcome to DoFast{user.name ? `, ${user.name}` : ""} 👋
      </h1>
      <p className="text-gray-400 mb-10">
        DoFast lets you connect your website and update it by chatting with AI.
        Here&apos;s how it works:
      </p>

      <div className="flex flex-col gap-4 mb-10">
        {steps.map((item) => (
          <div
            key={item.step}
            className="flex gap-5 bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="text-4xl font-black text-white/20">{item.step}</div>
            <div>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-3">
                {item.title}
                {item.badge && (
                  <span className="bg-white/10 border border-white/20 text-gray-400 text-xs px-3 py-1 rounded-full font-normal">
                    {item.badge}
                  </span>
                )}
              </h2>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <form action={completeOnboarding} className="text-center">
        <button
          type="submit"
          className="bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-200 transition"
        >
          Got it — take me to my dashboard
        </button>
      </form>
    </div>
  );
}
