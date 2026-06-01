import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white overflow-hidden">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/8 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[200px]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">ScreenCast</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/view"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-4 py-2"
          >
            View Screen
          </Link>
          <Link
            href="/share"
            className="text-sm bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 text-zinc-200 px-4 py-2 rounded-lg transition-all duration-200"
          >
            Share Screen
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10">
        <section className="max-w-4xl mx-auto px-6 pt-16 sm:pt-24 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-800/40 border border-zinc-700/30 rounded-full px-4 py-1.5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              Peer-to-peer · No servers · Encrypted
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 bg-clip-text text-transparent">
              Share your screen
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              in real-time
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Instantly share your screen with anyone using WebRTC peer-to-peer
            technology. No downloads, no accounts, no hassle — just a simple
            session code.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/share"
              className="group relative inline-flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto justify-center"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
                />
              </svg>
              Share Your Screen
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link
              href="/view"
              className="group inline-flex items-center gap-2.5 bg-zinc-800/40 hover:bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 font-semibold px-8 py-4 rounded-xl transition-all duration-300 hover:border-zinc-600/50 w-full sm:w-auto justify-center"
            >
              <svg
                className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              View a Screen
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                ),
                title: "Instant Connection",
                desc: "No downloads or installations required. Share in seconds with just a browser.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                ),
                title: "Peer-to-Peer",
                desc: "Direct WebRTC connection ensures low latency and your data never touches our servers.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                  />
                ),
                title: "Mobile Friendly",
                desc: "View shared screens on any device — phones, tablets, or desktops.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                  />
                ),
                title: "Session Codes",
                desc: "Simple 8-character codes make sharing easy. Just copy and share.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.788m13.788 0c3.808 3.808 3.808 9.98 0 13.788M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                ),
                title: "Auto Reconnect",
                desc: "Connection drops are handled gracefully with automatic reconnection attempts.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
                  />
                ),
                title: "Cloud Deployed",
                desc: "Deployed on Vercel with global edge distribution for fast access everywhere.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-zinc-800/20 hover:bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-700/50 rounded-xl p-6 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-zinc-700/30 flex items-center justify-center mb-4 group-hover:border-zinc-600/50 transition-colors">
                  <svg
                    className="w-5 h-5 text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            How It Works
          </h2>
          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Start Sharing",
                desc: 'Click "Share Your Screen" and select which screen, window, or tab you want to share.',
              },
              {
                step: "02",
                title: "Share the Code",
                desc: "Copy the unique 8-character session code and send it to your viewer via any messaging app.",
              },
              {
                step: "03",
                title: "Watch Live",
                desc: "The viewer enters the session code and instantly sees your screen in real-time.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-zinc-700/30 flex items-center justify-center">
                  <span className="text-sm font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-200 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800/50 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-600">
              Built with Next.js, WebRTC, and deployed on Vercel
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/share"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Share
              </Link>
              <Link
                href="/view"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                View
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
