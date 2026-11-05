import { formatRelativeTime } from "@/lib/discovery";

function describeEvent(event, gamesBySlug) {
  const username = event.profiles?.username || "a player";
  const game = event.game ? gamesBySlug[event.game] : null;
  const gameName = game?.name || event.game;

  switch (event.event_type) {
    case "new_best":
      return { icon: "🎯", text: `${username} set a new best in ${gameName || "a game"}` };
    case "achievement":
      return { icon: "🏆", text: `${username} unlocked ${event.meta?.achievement_name || "an achievement"}` };
    case "hall_of_fame":
      return { icon: "🏛️", text: `${username} entered the Hall of Fame` };
    case "duel_win":
      return { icon: "⚔️", text: `${username} won a duel${gameName ? ` in ${gameName}` : ""}` };
    case "level_up":
      return { icon: "⬆️", text: `${username} reached Level ${event.meta?.level ?? "?"}` };
    default:
      return null;
  }
}

// A server-rendered list, not a client poller — this is genuinely
// what just happened across the site, refreshed whenever the
// dashboard itself is loaded, not simulated or padded with filler.
export default function ActivityFeed({ events, gamesBySlug }) {
  const described = events.map((e) => ({ ...describeEvent(e, gamesBySlug), created_at: e.created_at })).filter((e) => e && e.text);

  if (described.length === 0) return null;

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel p-5 sm:p-6 mb-10">
      <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-4">ACTIVITY</h2>
      <ul className="space-y-2.5">
        {described.slice(0, 12).map((e, i) => (
          <li key={i} className="flex items-center gap-2.5 font-mono text-[11px] text-textDim">
            <span className="shrink-0">{e.icon}</span>
            <span className="text-textLight flex-1">{e.text}</span>
            <span className="shrink-0 text-[10px]">{formatRelativeTime(e.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
