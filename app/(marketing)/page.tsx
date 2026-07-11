"use client";
import { useState } from "react";
import Link from "next/link";

const steps = [
  {
    title: "Connect your site",
    desc: "Link the GitHub repository behind your website. DoFast reads it so it knows what it can change.",
  },
  {
    title: "Ask for a change",
    desc: '"Update our phone number." "Change the photo on the About page." Plain English is the whole interface.',
  },
  {
    title: "Preview it, then make it live",
    desc: "Every change builds a private preview first. Nothing touches your live site until you approve it.",
  },
];

const promises = [
  {
    title: "You approve every change",
    desc: "DoFast proposes; you decide. There is no auto-publish, ever.",
  },
  {
    title: "Preview before live",
    desc: "See exactly how your site will look on a private copy first.",
  },
  {
    title: "Undo anytime",
    desc: "Every published change is recorded and can be put back the way it was.",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      alert("Something went wrong. Please try again.");
    }
  };

  const waitlistForm = submitted ? (
    <div className="rounded-card border border-line bg-surface p-6 text-center">
      <h3 className="font-serif text-xl font-medium mb-2">
        You&apos;re on the list
      </h3>
      <p className="text-sm text-ink-secondary">
        We&apos;ll email you at <span className="text-ink">{email}</span> when
        DoFast is ready for you.
      </p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        placeholder="you@yourbusiness.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-11 flex-1 rounded-control border border-line-strong bg-surface px-4 text-body text-ink placeholder:text-ink-tertiary focus:outline-none"
      />
      <button
        type="submit"
        className="h-11 whitespace-nowrap rounded-control bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-strong"
      >
        Join the waitlist
      </button>
    </form>
  );

  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <span className="font-serif text-lg font-semibold">DoFast</span>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm text-ink-secondary transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <a
            href="#waitlist"
            className="rounded-control bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
          >
            Join the waitlist
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-6 pt-24 pb-20 text-center">
        <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
          Your website, updated by asking.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-body text-ink-secondary">
          DoFast connects to the code behind your site and makes the changes
          you describe. You see a preview of every change before it goes live.
        </p>
        <div id="waitlist" className="mx-auto mt-10 max-w-md">
          {waitlistForm}
          <p className="mt-3 text-sm text-ink-tertiary">
            Free during beta. No credit card required.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="mb-12 text-center font-serif text-3xl font-semibold">
            How it works
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {steps.map((item, index) => (
              <li key={item.title}>
                <p className="font-serif text-2xl font-semibold text-ink-tertiary">
                  {index + 1}
                </p>
                <h3 className="mt-2 mb-1 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-ink-secondary">{item.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-3 text-center font-serif text-3xl font-semibold">
          Built to be trusted with your live site
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-ink-secondary">
          DoFast changes real websites, so safety is the product — not a
          setting.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {promises.map((item) => (
            <div key={item.title} className="rounded-card border border-line bg-surface p-6">
              <h3 className="mb-1 font-semibold">{item.title}</h3>
              <p className="text-sm text-ink-secondary">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-serif text-2xl font-semibold mb-3">
            Works with what you have
          </h2>
          <p className="mx-auto max-w-xl text-ink-secondary">
            DoFast currently supports websites built with Next.js or React and
            hosted through GitHub. More platforms will follow — join the
            waitlist and we&apos;ll tell you when yours is ready.
          </p>
          <a
            href="#waitlist"
            className="mt-8 inline-block rounded-control bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-strong"
          >
            Join the waitlist
          </a>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-ink-tertiary">
        © 2026 DoFast. All rights reserved.
      </footer>
    </main>
  );
}
