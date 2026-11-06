import Link from "next/link";
import { ChevronDown } from "@/components/store/Icons";

// Which leaderboard am I looking at, and how do I switch? Overall, then one entry per game grouped by pass (Free, Power Pass,
// Legend Pass), so the list stays tidy however many games there are.
//   Desktop: a sticky list beside the table.   Phone / tablet: a closed box above the table that opens to the same list.
// groups = [{ label, color, items: [{ key, label }] }]  (label is null for the "Overall" group)
function List({ groups, active, hrefFor }) {
  return (
    <div className="space-y-5">
      {groups.map((g, i) => (
        <div key={g.label || i}>
          {g.label && (
            <p className="mb-1 flex items-center gap-2 px-3 text-[12.5px] font-semibold" style={{ color: g.color }}>
              <i className="h-2 w-2 rounded-full" style={{ background: g.color }} />
              {g.label}
            </p>
          )}
          <ul>
            {g.items.map((it) => (
              <li key={it.key}>
                <Link
                  href={hrefFor(it.key)}
                  aria-current={active === it.key ? "page" : undefined}
                  className="block rounded-lg px-3 py-2 text-[14px] leading-snug text-[#c3bbea] transition-colors hover:bg-white/5 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:font-semibold aria-[current=page]:text-white"
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function BoardPicker({ groups, active, activeLabel, hrefFor }) {
  return (
    <>
      <details className="group st-band lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14.5px] [&::-webkit-details-marker]:hidden">
          <span><span className="text-[#c3bbea]">Board: </span><span className="font-semibold text-[#f5f0ff]">{activeLabel}</span></span>
          <span className="text-[#c3bbea] transition-transform group-open:rotate-180"><ChevronDown /></span>
        </summary>
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-3">
          <List groups={groups} active={active} hrefFor={hrefFor} />
        </div>
      </details>

      <nav aria-label="Leaderboards" className="hidden lg:block">
        <div className="sticky top-[88px] max-h-[calc(100vh-110px)] overflow-y-auto pr-2">
          <List groups={groups} active={active} hrefFor={hrefFor} />
        </div>
      </nav>
    </>
  );
}
