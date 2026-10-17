const YEAR = new Date().getFullYear();

// Standard copyright and non-affiliation notice, with a proper footer map so people (and search engines) can reach every public page.
export default function SiteFooter() {
  const cols = [
    ["Play", [["/dashboard", "All games"], ["/leaderboard", "Leaderboard"], ["/tournaments", "Tournaments"], ["/hall-of-fame", "Hall of fame"]]],
    ["Company", [["/about", "About"], ["/pricing", "Pricing"], ["/changelog", "What's new"], ["/contact", "Contact"]]],
    ["Legal", [["/terms", "Terms"], ["/privacy", "Privacy"], ["/refund-policy", "Refund policy"], ["/feedback", "Feedback"]]],
  ];
  return (
    <footer className="w-full mt-auto border-t border-lineColor/50" style={{ background: "rgba(8,4,22,0.55)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-28 sm:pb-10 grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg font-display font-extrabold text-sm text-ink" style={{ background: "linear-gradient(135deg,#ffc233,#ff3ea5)" }}>T</span>
            <span className="font-display font-bold text-lg tracking-tight text-textLight">Tap &amp; Score</span>
          </div>
          <p className="text-sm text-textDim mt-3 max-w-xs leading-relaxed">Browser games with real leaderboards. One free account, nothing to install.</p>
        </div>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="font-display font-bold text-sm text-textLight mb-3">{title}</p>
            <ul className="space-y-2">
              {links.map(([href, label]) => (
                <li key={href}><a href={href} className="text-sm text-textDim hover:text-textLight transition-colors">{label}</a></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-lineColor/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-[11px] text-textDim leading-relaxed">
          <p>© {YEAR} Tap &amp; Score. All rights reserved.</p>
          <p className="mt-1 max-w-3xl">
            Tap &amp; Score is an independent entertainment platform. Individual games may draw creative inspiration from genres and styles associated with other media, but Tap &amp; Score is not affiliated with, endorsed by, or sponsored by any third-party game, studio, or franchise.
          </p>
        </div>
      </div>
    </footer>
  );
}
