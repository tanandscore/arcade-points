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
      className="text-left rounded-xl border border-lineColor p-5 flex flex-col gap-3 bg-bgPanel hover:-translate-y-0.5 transition-transform relative"
    >
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
      <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl bg-bgPanel3">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: accentColor }}>
          {name}
          {price ? (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-accentAmber text-accentAmber">
              {price}
            </span>
          ) : (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-lineColor text-textDim">
              FREE
            </span>
          )}
        </h3>
        <p className="text-xs mt-1 text-textDim">{tagline}</p>
      </div>
      <div className="font-mono text-[11px] mt-1 text-textDim">
        Your best: <span className="text-textLight">{(best || 0).toLocaleString()}</span>
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
          className="font-pixel text-[9px] mt-1 inline-block px-3 py-2 rounded-md text-center border border-accentAmber text-accentAmber"
        >
          🔒 VIEW TOURNAMENT ▸
        </span>
      ) : (
        <span
          className="font-pixel text-[9px] mt-1 inline-block px-3 py-2 rounded-md text-center text-bgDeep"
          style={{ background: accentColor }}
        >
          {lastPlayedLabel ? "RESUME ▸" : "PLAY ▸"}
        </span>
      )}
    </Link>
  );
}
