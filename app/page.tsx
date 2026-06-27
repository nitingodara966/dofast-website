export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <span className="text-2xl font-bold text-white">DoFast</span>
        <a href="#waitlist" className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition">
          Join Waitlist
        </a>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <div className="bg-white/10 text-white text-xs px-4 py-1.5 rounded-full mb-6 border border-white/20">
          🚀 Coming Soon — Join the waitlist
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight max-w-4xl">
          Update your website by just{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            texting AI
          </span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-xl">
          Connect your GitHub, Vercel, or WordPress site. Then just chat — DoFast handles the rest. No code needed.
        </p>

        {/* Waitlist Form */}
        <div id="waitlist" className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white"
          />
          <button className="bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition">
            Get Early Access
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-600">Free during beta. No credit card required.</p>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-14">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Connect your site", desc: "Link your GitHub repo, Vercel project, or WordPress site in one click." },
            { step: "2", title: "Text your change", desc: 'Just say "Change our contact email" or "Add a new team member".' },
            { step: "3", title: "Done in seconds", desc: "DoFast makes the change, shows you a preview, and deploys when you approve." },
          ].map((item) => (
            <div key={item.step} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-4xl font-black text-white/20 mb-4">{item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-10 pb-24">
        <h2 className="text-3xl font-bold text-center mb-14">Why DoFast?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: "⚡", title: "Instant updates", desc: "No waiting for a developer. Changes go live in minutes." },
            { icon: "🔗", title: "Works with your stack", desc: "GitHub, Vercel, WordPress — connect what you already use." },
            { icon: "🛡️", title: "Safe by default", desc: "Every change creates a preview first. You approve before it goes live." },
            { icon: "💬", title: "Just chat", desc: "No dashboards to learn. Just type what you want in plain English." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
              <span className="text-3xl">{f.icon}</span>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 py-20 border-t border-white/10">
        <h2 className="text-4xl font-bold mb-4">Ready to move fast?</h2>
        <p className="text-gray-400 mb-8">Join hundreds of businesses updating their sites with AI.</p>
        <a href="#waitlist" className="bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-200 transition">
          Join the Waitlist
        </a>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-600 text-sm border-t border-white/10">
        © 2025 DoFast. All rights reserved.
      </footer>
    </main>
  );
}