import Link from "next/link";
import CookieSettingsLink from "@/components/CookieSettingsLink";

const YEAR = new Date().getFullYear();

const COLUMNS = [
  ["Store", [["Featured", "/"], ["Free games", "/games?tier=free"], ["Power Pass", "/games?tier=power"], ["Legend Pass", "/games?tier=legend"], ["Pricing", "/pricing"]]],
  ["Community", [["Leaderboard", "/leaderboard"], ["Tournaments", "/tournaments"], ["Hall of Fame", "/hall-of-fame"], ["Game gallery", "/gallery"], ["What's new", "/changelog"]]],
  ["Company", [["About", "/about"], ["Contact", "/contact"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund policy", "/refund-policy"]]],
];

// Upgrade 70: three quiet columns instead of one long line of links. The copyright and the independence notice stay: they put the
// world on notice of copyright and clarify that Tap & Score is not affiliated with any of the real games, films or franchises
// individual titles draw creative inspiration from. That doesn't make anything "uncopyable", but it is genuine and standard.
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0e0722] pb-24 md:pb-10">
      <div className="st-container pt-10 grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-[1.3fr_repeat(3,1fr)] md:gap-10">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Link href="/" className="st-logo" aria-label="Tap and Score home">TAP<b>&amp;</b>SCORE</Link>
          <p className="st-muted text-[14px] leading-relaxed mt-4">Big games in your browser. No downloads, no ads. One account keeps your scores and saves.</p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="text-[13px] font-bold text-[#f5f0ff] mb-3">{title}</h2>
            <ul className="space-y-2">
              {links.map(([label, href]) => (
                <li key={label}><Link href={href} className="text-[14px] text-[#c3bbea] hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="st-container mt-10">
        <div className="pt-6 border-t border-white/10 text-[12.5px] text-[#a99fd6] leading-relaxed">
          <p className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
            <span>&copy; {YEAR} Tap &amp; Score. All rights reserved.</span>
            <Link href="/privacy#rights" className="hover:text-white underline underline-offset-2">Your Privacy Choices</Link>
            <CookieSettingsLink className="hover:text-white underline underline-offset-2" />
          </p>
          <p className="max-w-3xl">
            Tap &amp; Score is an independent entertainment platform. Individual games may draw creative inspiration from genres and
            styles associated with other media, but Tap &amp; Score is not affiliated with, endorsed by, or sponsored by any third-party
            game, studio, or franchise.
          </p>
        </div>
      </div>
    </footer>
  );
}
