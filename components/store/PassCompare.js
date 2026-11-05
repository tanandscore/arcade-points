import Link from "next/link";
import { TIERS, TIER_ORDER } from "@/lib/catalog";
import FungiesSubscribeButton from "@/components/account/FungiesSubscribeButton";
import { CheckIcon, ArrowRight } from "./Icons";

const PERKS = {
  free: ["Cloud saves on every device", "Leaderboards, daily challenges and streaks"],
  power: ["Animated avatars and premium themes", "New Power Pass games as they launch"],
  legend: ["Animated avatars and premium themes", "Built for laptop and desktop"],
};
const LEAD = { free: null, power: "Everything in Free", legend: "Everything in Power Pass" };
const TAGLINE = {
  free: "Start playing in seconds. No card, no catch.",
  power: "Bigger, deeper 2D games with levels, bosses and cloud saves.",
  legend: "The four flagship games: full 3D racing, shooting and strategy.",
};

// The full side-by-side comparison for the pricing page. Server component: it only needs data, no hooks.
//   games / soon : live and announced games     plans : getPassPlans()
//   userId       : null when signed out         current : "legend" | "power" | null (what the player already has)
export default function PassCompare({ games, soon, plans, userId = null, current = null }) {
  const cols = TIER_ORDER.map((id) => {
    const t = TIERS[id];
    const live = games.filter((g) => g.tier === id);
    const upcoming = soon.filter((g) => g.tier === id);
    return { id, t, live, upcoming, plan: plans?.[id] || null };
  });
  const nextQuery = userId ? "" : "?next=/pricing";
  // "$0" written with the same currency symbol the paid passes use, so the three prices read as one family
  const sym = ((plans?.power?.monthly || plans?.legend?.monthly || "").match(/^[^\d\s]+/) || ["$"])[0];

  return (
    <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
      {cols.map(({ id, t, live, upcoming, plan }) => {
        const rank = t.rank;
        const have = current ? TIERS[current].rank : -1;
        const owned = have >= rank && id !== "free";
        return (
          <section key={id} className="st-panel flex flex-col p-6 sm:p-7 relative overflow-hidden" style={{ boxShadow: `inset 0 3px 0 ${t.color}` }} aria-labelledby={`pass-${id}`}>
            <h2 id={`pass-${id}`} className="st-h2" style={{ color: t.color }}>{t.name}</h2>
            <div className="mt-3 flex items-baseline gap-1.5">
              {id === "free" ? (
                <>
                  <span className="st-h1" style={{ fontSize: "2.6rem" }}>{sym}0</span>
                  <span className="st-muted text-sm">forever</span>
                </>
              ) : (
                <>
                  <span className="st-h1" style={{ fontSize: "2.6rem" }}>{plan?.monthly || "-"}</span>
                  <span className="st-muted text-sm">per month</span>
                </>
              )}
            </div>
            <p className="st-muted text-sm mt-1 min-h-[1.25rem]">
              {id === "free" ? "No card needed." : plan?.annual ? `or ${plan.annual} a year` : "Cancel any time."}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#e6e0ff]">{TAGLINE[id]}</p>

            <div className="mt-5 pt-5 border-t border-white/10 flex-1">
              {LEAD[id] && (
                <p className="flex items-center gap-2 text-[14px] font-semibold mb-3" style={{ color: t.color }}>
                  <CheckIcon size={16} /> {LEAD[id]}
                </p>
              )}
              <ul className="space-y-2.5">
                {live.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/games/${g.slug}`} className="flex items-center gap-2.5 text-[14.5px] hover:underline underline-offset-4">
                      <span className="w-6 text-center" aria-hidden>{g.icon}</span>
                      <span className="font-semibold">{g.name}</span>
                      <span className="st-muted text-[12.5px] ml-auto shrink-0">{g.style}</span>
                    </Link>
                  </li>
                ))}
                {upcoming.map((g) => (
                  <li key={g.slug} className="flex items-center gap-2.5 text-[14.5px] opacity-60">
                    <span className="w-6 text-center" aria-hidden>{g.icon}</span>
                    <span className="font-semibold">{g.name}</span>
                    <span className="st-chip ml-auto !h-5 !text-[11px] !px-2">Coming soon</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-5 space-y-2 text-[13.5px] st-muted">
                {PERKS[id].map((p) => (
                  <li key={p} className="flex items-start gap-2"><span className="mt-[3px]" style={{ color: t.color }}><CheckIcon size={14} /></span>{p}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6" style={{ "--acc": t.color }}>
              {id === "free" ? (
                userId ? (
                  <Link href="/games?tier=free" className="st-btn st-btn-ghost w-full">Browse free games</Link>
                ) : (
                  <Link href="/signup" className="st-btn st-btn-primary w-full">Create a free account</Link>
                )
              ) : owned ? (
                <div className="st-btn st-btn-ghost w-full is-off !opacity-100 !pointer-events-none" style={{ borderColor: t.color, color: t.color }}>
                  <CheckIcon size={17} /> {current === id ? "Your plan" : `Included in ${TIERS[current].name}`}
                </div>
              ) : userId ? (
                <FungiesSubscribeButton
                  fungiesCheckoutUrlMonthly={plan?.checkoutMonthly}
                  fungiesCheckoutUrlAnnual={plan?.checkoutAnnual}
                  priceDisplayMonthly={plan?.monthly}
                  priceDisplayAnnual={plan?.annual}
                  planId={plan?.id}
                  planName={t.name}
                  userId={userId}
                  accent={t.color}
                />
              ) : (
                <Link href={`/signup${nextQuery}`} className="st-btn st-btn-primary w-full">Sign up to get {t.name}</Link>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// The small version shown at the bottom of the store home: only the passes the player does not have yet, one slim row each.
export function PassBand({ tier = null, plans, counts }) {
  const offers = ["power", "legend"].filter((id) => TIERS[id].rank > (tier ? TIERS[tier].rank : -1));
  if (!offers.length) return null;
  const line = {
    power: (c) => `${c.power || "More"} deeper 2D games with bosses, levels and cloud saves. Includes every Free game.`,
    legend: (c) => `${c.legend || 4} flagship 3D games: street racing, tactical shooting and two strategy epics. Includes everything else.`,
  };
  return (
    <section aria-label="Passes" className="space-y-4">
      {offers.map((id) => {
        const t = TIERS[id];
        const plan = plans?.[id];
        return (
          <Link
            key={id}
            href="/pricing"
            className="st-panel group p-5 sm:p-6 flex flex-wrap items-center gap-x-6 gap-y-3 transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: `inset 0 0 0 1px ${t.color}55` }}
          >
            <div className="min-w-0 flex-1 basis-[260px]">
              <h3 className="st-h2" style={{ color: t.color }}>{t.name}</h3>
              <p className="st-muted text-[14.5px] leading-relaxed mt-1.5 max-w-[56ch]">{line[id](counts)}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {plan?.monthly && (
                <p className="text-right leading-tight">
                  <span className="block st-h2">{plan.monthly}</span>
                  <span className="st-muted text-xs">per month</span>
                </p>
              )}
              <span className="st-link text-sm inline-flex items-center gap-1.5">Compare <ArrowRight size={14} /></span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
