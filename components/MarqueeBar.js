import Link from "next/link";

// The site's top bar for public pages: a slim glass header with the logo mark and a slot for the page's actions.
export default function MarqueeBar({ rightSlot }) {
  return (
    <header className="sticky top-0 z-40 ap-glass border-x-0 border-t-0" style={{ background: "rgba(15,8,38,0.72)" }}>
      <div className="flex items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 h-14">
        <Link href="/" className="flex items-center gap-2.5 group" aria-label="Tap & Score home">
          <span className="grid place-items-center w-8 h-8 rounded-lg font-display font-extrabold text-sm text-ink" style={{ background: "linear-gradient(135deg,#ffc233,#ff3ea5)" }}>T</span>
          <span className="font-display font-bold text-lg tracking-tight text-textLight">Tap &amp; Score</span>
        </Link>
        {rightSlot}
      </div>
    </header>
  );
}
