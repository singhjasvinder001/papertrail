import Link from 'next/link';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="flex items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-cyan-500 shadow-lg shadow-accent-500/25"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Paper<span className="text-accent-400">Trail</span>
      </span>
    </span>
  );
}

export function NavBar({ username, onLogout }: { username?: string | null; onLogout?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="transition hover:opacity-90">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          {username ? (
            <>
              <Link href="/app" className="btn-ghost !py-2">
                Dashboard
              </Link>
              <span className="hidden items-center gap-2 text-sm text-slate-300 sm:inline-flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-600/30 text-xs font-bold text-accent-300">
                  {username.slice(0, 1).toUpperCase()}
                </span>
                {username}
              </span>
              <button className="btn-ghost !py-2" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost !py-2">
                Log in
              </Link>
              <Link href="/register" className="btn-primary !py-2">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
