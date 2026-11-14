import Link from "next/link";
import Capsule from "./Capsule";
import TierBadge from "./TierBadge";

// One game in a shelf: the picture, the name, the genre. Nothing else unless it earns its place:
//   showTier   – the pass badge (hide it inside a shelf that already is "Power Pass")
//   progress   – 0..1 bar along the bottom of the picture (library, continue playing)
//   note       – one line of small print under the genre ("Best 12,400", "Played 2h ago")
export default function GameCard({ game: g, showTier = true, progress = null, note = null, priority = false, href }) {
  const soon = g.status === "soon";
  return (
    <Link href={href || `/games/${g.slug}`} className="st-card group" style={{ "--acc": g.accentColor }}>
      <div className="st-art">
        <Capsule game={g} priority={priority} />
        {showTier && g.tier !== "free" && <TierBadge tier={g.tier} className="absolute left-2.5 top-2.5" />}
        {/* On a phone two cards sit side by side, so with a pass badge on the left "Coming soon" shortens to "Soon" to avoid a collision. */}
        {soon ? (
          <span className="st-flag absolute right-2.5 top-2.5">
            {showTier && g.tier !== "free" ? <><span className="sm:hidden">Soon</span><span className="hidden sm:inline">Coming soon</span></> : "Coming soon"}
          </span>
        ) : g.isNew ? <span className="st-flag absolute right-2.5 top-2.5">New</span> : null}
        {g.underMaintenance && <span className="st-flag absolute right-2.5 bottom-2.5" style={{ background: "#ffb703" }}>Updating</span>}
        {progress != null && <div className="st-progress" aria-hidden><i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></div>}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <h3 className="st-card-title">{g.name}</h3>
        {g.tier === "free" && showTier && !soon && <span className="text-[12.5px] font-bold shrink-0" style={{ color: "#3ee6e0" }}>Free</span>}
      </div>
      <p className="st-card-sub">{g.style || g.genre}</p>
      {note && <p className="mt-1 text-[12.5px] text-[#a99fd6]">{note}</p>}
    </Link>
  );
}
