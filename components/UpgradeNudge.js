import Link from "next/link";
import { getGames } from "@/lib/games";

// Shown on free games, to non-subscribers only. This is what "ad-free"
// means for Pass holders here — rather than wiring up a third-party ad
// network, subscribing to any Pass tier removes this banner entirely.
// The count is fetched live so it never drifts out of date as more
// paid games are added.
export default async function UpgradeNudge() {
  const games = await getGames();
  const premiumCount = games.filter((g) => g.accessType === "subscription").length;

  return (
    <div className="mt-8 rounded-xl border border-accentAmber/40 bg-bgPanel p-4 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-textDim">
        <span className="text-accentAmber">👑 Go Elite</span> — a Pass unlocks {premiumCount} deep
        games and removes this banner.
      </p>
      <Link href="/dashboard#power-pass" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentAmber text-bgDeep shrink-0">
        See Pass games ▸
      </Link>
    </div>
  );
}
