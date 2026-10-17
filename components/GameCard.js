import Link from "next/link";
import TournamentCountdown from "./TournamentCountdown";

// activeTournament, when present, is { name, endsAt, locked } — locked
// means the admin has opted this tournament into "tournament-only"
// play (see migration_060): the card becomes non-clickable for normal
// play and points to /tournaments instead, where the real "Play Now"
// link is what actually grants entry.
export default function GameCard({ href, icon, name, tagline, accentColor, best, price, underMaintenance, desktopOnly, trending, lastPlayedLabel, activeTournament }) {
  const locked = activeTournament?.locked;

  return (
    <Link
      href={locked ? "/tournaments" : href}
      className="ap-card text-left p-5 flex flex-col gap-3 hover:-translate-y-1 relative overflow-hidden group"
      style={{ "--c": accentColor }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      <span aria-hidden className="absolute -top-16 -right-10 w-44 h-44 rounded-full opacity-[0.13] group-hover:opacity-25 transition-opacity" style={{ background: `radial-gradient(closest-side, ${accentColor}, transparent)` }} />
      {trending && (
        <span className="absolute top-3 left-3 font-mono text-[9px] px-2 py-1 rounded-full bg-accentMagenta/15 border border-accentMagenta text-accentMagenta">
          🔥 Trending
        </span>
      )}
      {underMaintenance && (
        <span className="absolute top-3 right-3 font-mono text-[9px] px-2 py-1 rounded-full bg-accentAmber/15 border border-accentAmber text-accentAmber">
          🔧 Updating
        </span>
      )}
      {!underMaintenance && desktopOnly && (
        <span className="absolute top-3 right-3 font-mono text-[9px] px-2 py-1 rounded-full bg-bgPanel3 border border-lineColor text-textDim">
          💻 Desktop only
        </span>
      )}
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${accentColor}33, rgba(255,255,255,0.05))`, border: `1px solid ${accentColor}44` }}>
        {icon}
      </div>
      <div>
        <h3 className="font-display font-bold text-lg leading-tight flex items-center gap-2 flex-wrap" style={{ color: "#f5f0ff" }}>
          {name}
          {price ? (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gold/15 text-gold">
              {price}
            </span>
          ) : (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accentCyan/12 text-accentCyan">
              FREE
            </span>
          )}
        </h3>
        <p className="text-[13px] leading-snug mt-1.5 text-textDim">{tagline}</p>
      </div>
      <div className="font-mono text-[11px] mt-auto pt-1 text-textDim">
        Your best <span className="text-gold font-semibold ml-1">{(best || 0).toLocaleString()}</span>
        {lastPlayedLabel && <span className="block mt-0.5">Last played {lastPlayedLabel}</span>}
      </div>
      {activeTournament && (
        // A real, live-only flash — activeTournament is only ever
        // passed in for a tournament with status "active" (already
        // started, not upcoming), so this never shows before a
        // countdown to a start time would make sense; it always
        // shows a countdown to the END instead, since that's the
        // only thing meaningful once a tournament is actually live.
        <div className="rounded-md border border-accentAmber/50 bg-accentAmber/10 p-2.5 animate-announce-pulse">
          <p className="font-mono text-[10px] text-accentAmber font-bold">
            🏆 {locked ? "Tournament exclusive right now!" : "Live tournament — play here to climb the leaderboard!"}
          </p>
          <div className="mt-1.5">
            <TournamentCountdown targetIso={activeTournament.endsAt} size="sm" />
          </div>
        </div>
      )}
      {locked ? (
        <span
          className="font-body font-bold text-sm mt-1 inline-block px-3 py-2.5 rounded-xl text-center border border-accentAmber text-accentAmber"
        >
          🔒 View tournament
        </span>
      ) : (
        <span
          className="font-body font-bold text-sm mt-1 inline-block px-3 py-2.5 rounded-xl text-center text-ink"
          style={{ background: accentColor }}
        >
          {lastPlayedLabel ? "Resume" : "Play now"}
        </span>
      )}
    </Link>
  );
}
