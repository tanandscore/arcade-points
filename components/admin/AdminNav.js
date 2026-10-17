const GROUPS = [
  ["Run the site", [["/admin", "Overview"], ["/admin/announcements", "Announcements"], ["/admin/tournaments", "Tournaments"], ["/admin/changelog", "Changelog"]]],
  ["Players", [["/admin/user-management", "User management"], ["/admin/moderation", "Moderation"], ["/admin/live-activity", "Live activity"]]],
  ["Quality", [["/admin/game-testing", "Game testing"], ["/admin/maps", "Map switches"], ["/admin/errors", "Errors"], ["/admin/audit-log", "Audit log"]]],
];

// Grouped navigation for the admin area; the current page is highlighted.
export default function AdminNav({ active }) {
  return (
    <nav aria-label="Admin sections" className="ap-glass rounded-2xl p-3 sm:p-4 mb-8 grid gap-3 sm:grid-cols-3">
      {GROUPS.map(([title, links]) => (
        <div key={title}>
          <p className="text-[11px] font-semibold text-textDim mb-1.5 px-1">{title}</p>
          <div className="flex flex-wrap gap-1.5">
            {links.map(([href, label]) => (
              <a key={href} href={href} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={href === active ? { background: "rgba(62,230,224,0.16)", color: "#3ee6e0", boxShadow: "inset 0 0 0 1px rgba(62,230,224,0.5)" } : { color: "#cfc8f2", background: "rgba(255,255,255,0.04)" }}>{label}</a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
