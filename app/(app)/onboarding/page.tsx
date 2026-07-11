import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/surfaces";
import { buttonClasses } from "@/components/ui/button";
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
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold mb-2">
        Welcome to DoFast{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="text-ink-secondary mb-10">
        DoFast lets you connect your website and update it by chatting with AI.
        Here&apos;s how it works:
      </p>

      <ol className="mb-10 flex flex-col gap-4">
        {steps.map((item) => (
          <li
            key={item.step}
            className="flex gap-5 rounded-card border border-line bg-surface p-6"
          >
            <span className="font-serif text-2xl font-semibold text-ink-tertiary">
              {item.step}
            </span>
            <div>
              <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg font-semibold">
                {item.title}
                {item.badge && <Badge>{item.badge}</Badge>}
              </h2>
              <p className="text-sm text-ink-secondary">{item.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <form action={completeOnboarding} className="text-center">
        <button type="submit" className={buttonClasses("primary", "md")}>
          Got it — take me to my dashboard
        </button>
      </form>
    </div>
  );
}
