// Upgrade 70: the title block every inner page opens with (Leaderboard, Hall of Fame, Tournaments, ...): a big plain title,
// one quiet line under it, and room on the right for a button. Same size as the Library and Pricing titles.
export default function PageHeader({ title, sub, right }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-3xl">
        <h1 className="st-h1" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)" }}>{title}</h1>
        {sub && <p className="st-muted mt-2 text-[15.5px] leading-relaxed">{sub}</p>}
      </div>
      {right}
    </header>
  );
}
