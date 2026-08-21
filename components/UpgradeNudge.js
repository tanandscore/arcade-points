import Link from "next/link";

// Shown on free games, to non-subscribers only. This is what "ad-free"
// means for Premium subscribers here — rather than wiring up a
// third-party ad network, subscribing removes this banner entirely.
export default function UpgradeNudge() {
  return (
    <div className="mt-8 rounded-xl border border-accentAmber/40 bg-bgPanel p-4 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-textDim">
        <span className="text-accentAmber">👑 Go Premium</span> — unlock 6 deep games and remove this banner.
      </p>
      <Link href="/dashboard#premium" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentAmber text-bgDeep shrink-0">
        See Premium games ▸
      </Link>
    </div>
  );
}
