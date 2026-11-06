// Admin navigation: three groups, each link says in plain words what it is for. The current page is highlighted.
const GROUPS = [
  ["Run the site", "🏠", [["/admin", "Overview", "Numbers at a glance, feedback and settings"], ["/admin/announcements", "Announcements", "Banners that players see"], ["/admin/tournaments", "Tournaments", "Create and manage events"], ["/admin/season-planner", "Season planner", "Plan which games are featured"], ["/admin/changelog", "Changelog", "Write the “what’s new” notes"]]],
  ["Players", "👥", [["/admin/user-management", "User management", "Find a player, check their pass"], ["/admin/moderation", "Moderation", "Reports, bans and clean-up"], ["/admin/live-activity", "Live activity", "Who is playing right now"]]],
  ["Quality", "🛠️", [["/admin/game-testing", "Game testing", "Try games before they go public"], ["/admin/maps", "Map switches", "Turn game maps on or off"], ["/admin/errors", "Errors", "Problems players ran into"], ["/admin/audit-log", "Audit log", "Who changed what, and when"]]],
];

export default function AdminNav({ active }) {
  return (
    <nav aria-label="Admin sections" className="mb-8">
      <p className="text-sm font-bold mb-1">Admin menu</p>
      <p className="text-sm mb-4" style={{ color: "var(--ad-dim,#a99fd6)" }}>Pick what you want to do. Everything here changes the live site, so double-check before you save.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {GROUPS.map(([title, icon, links]) => (
          <div key={title} className="rounded-xl border border-lineColor bg-bgPanel p-3">
            <p className="text-sm font-bold mb-2 px-1">{icon} {title}</p>
            <div className="flex flex-col gap-1">
              {links.map(([href, label, hint]) => (
                <a key={href} href={href} aria-current={href === active ? "page" : undefined} className="block rounded-lg px-3 py-2 transition-colors"
                  style={href === active ? { background: "rgba(11,124,132,0.12)", boxShadow: "inset 3px 0 0 var(--ad-cyan,#3ee6e0)" } : { background: "transparent" }}>
                  <span className="block text-sm font-semibold" style={{ color: href === active ? "var(--ad-cyan,#3ee6e0)" : undefined }}>{label}</span>
                  <span className="block text-xs" style={{ color: "var(--ad-dim,#a99fd6)" }}>{hint}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
