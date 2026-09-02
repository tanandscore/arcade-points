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
    <div className="min-h-screen bg-bgDeep text-textLight flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-3xl mb-4">📡</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">YOU'RE OFFLINE</p>
        <p className="text-textDim text-sm">
          This page hasn't been loaded before, so there's nothing saved for it yet. Pages you've already visited —
          like your dashboard or profile — will still open normally.
        </p>
      </div>
    </div>
  );
}
