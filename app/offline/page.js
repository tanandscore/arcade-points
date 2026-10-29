export const metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

// This is the ONE page the service worker deliberately precaches at
// install time (see public/sw.js) — everything else is cached
// opportunistically as it's actually visited, not upfront. It has to
// stay simple and dependency-free (no live data, no client
// components) since it's the fallback shown when a page that was
// never cached gets requested while offline.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bgDeep px-4 text-textLight">
      <div className="max-w-sm text-center">
        <p className="st-logo" style={{ fontSize: 14 }}>TAP<b>&amp;</b>SCORE</p>
        <h1 className="st-h1 mt-6" style={{ fontSize: "2rem" }}>You&apos;re offline</h1>
        <p className="st-muted mt-3 text-[15.5px] leading-relaxed">
          This page hasn&apos;t been loaded before, so there&apos;s nothing saved for it yet. Pages you&apos;ve already visited,
          like your library or profile, will still open normally.
        </p>
      </div>
    </div>
  );
}
