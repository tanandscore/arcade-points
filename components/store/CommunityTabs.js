import Link from "next/link";

// The places that make up "Community", as a tab row under the page title (the same places are in the top bar's Community menu).
const TABS = [
  ["leaderboard", "Leaderboard", "/leaderboard"],
  ["hall", "Hall of Fame", "/hall-of-fame"],
  ["tournaments", "Tournaments", "/tournaments"],
  ["gallery", "Game gallery", "/gallery"],
  ["news", "What's new", "/changelog"],
];

export default function CommunityTabs({ active }) {
  return (
    <nav aria-label="Community" className="st-tabs mt-6">
      {TABS.map(([key, label, href]) => (
        <Link key={key} href={href} className="st-tab" aria-current={active === key ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
