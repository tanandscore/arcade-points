import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";
import { getGames } from "@/lib/games";

export const metadata = {
  title: "Pricing & Plans",
  alternates: { canonical: "/pricing" },
  description: "Tap & Score subscription plans and pricing — Power Pass, Legend Pass, and free Arcade games.",
};

// Deliberately public — no auth check, no redirect. PayU (and most
// payment gateways) require that subscription pricing and what each
// plan includes be visible to a visitor before they ever create an
// account, not hidden behind a login wall.
export default async function PricingPage() {
  const games = await getGames();

  const freeGames = games.filter((g) => g.category === "Arcade");
  const powerPassGames = games.filter((g) => g.category === "Power Pass");
  const legendPassGames = games.filter((g) => g.category === "Legend Pass");

  const powerPassPrice = powerPassGames[0]?.priceDisplay || null;
  const legendPassPrice = legendPassGames[0]?.priceDisplay || null;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
            Sign up
          </Link>
        }
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">PRICING & PLANS</h1>
        <p className="text-textDim text-sm mb-10">
          {games.length} games across three tiers. Subscriptions renew monthly and can be cancelled anytime — see our{" "}
          <Link href="/refund-policy" className="text-accentCyan underline">Refund & Cancellation Policy</Link>. Payments are processed securely via PayU.
        </p>

        <div className="grid sm:grid-cols-3 gap-5">
          <div className="rounded-xl border border-lineColor bg-bgPanel p-6 flex flex-col">
            <h2 className="font-pixel text-[11px] text-textLight mb-1">ARCADE</h2>
            <p className="font-pixel text-2xl text-accentMagenta mb-4">₹0</p>
            <p className="text-textDim text-xs mb-4">Free forever. No account required to try, sign up to save your scores and appear on leaderboards.</p>
            <p className="font-mono text-[10px] text-textDim mb-2 uppercase tracking-wide">{freeGames.length} games included</p>
            <ul className="text-[11px] text-textDim space-y-1 flex-1">
              {freeGames.slice(0, 8).map((g) => (
                <li key={g.slug}>{g.icon} {g.name}</li>
              ))}
              {freeGames.length > 8 && <li className="text-textDim/70">+ {freeGames.length - 8} more</li>}
            </ul>
          </div>

          <div className="rounded-xl border-2 p-6 flex flex-col bg-bgPanel" style={{ borderColor: "#ffb703" }}>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-1">POWER PASS</h2>
            <p className="font-pixel text-2xl text-accentAmber mb-4">{powerPassPrice || "—"}<span className="text-xs text-textDim">/mo</span></p>
            <p className="text-textDim text-xs mb-4">Everything in Arcade, plus every Power Pass game. Cancel anytime, keep access until the period you paid for ends.</p>
            <p className="font-mono text-[10px] text-textDim mb-2 uppercase tracking-wide">{powerPassGames.length} games included</p>
            <ul className="text-[11px] text-textDim space-y-1 flex-1">
              {powerPassGames.slice(0, 8).map((g) => (
                <li key={g.slug}>{g.icon} {g.name}</li>
              ))}
              {powerPassGames.length > 8 && <li className="text-textDim/70">+ {powerPassGames.length - 8} more</li>}
            </ul>
            <Link href="/signup" className="mt-4 font-pixel text-[9px] text-center px-4 py-2.5 rounded-md text-bgDeep" style={{ background: "#ffb703" }}>
              GET POWER PASS ▸
            </Link>
          </div>

          <div className="rounded-xl border-2 p-6 flex flex-col bg-bgPanel" style={{ borderColor: "#ff3ea5" }}>
            <h2 className="font-pixel text-[11px] text-accentMagenta mb-1">LEGEND PASS</h2>
            <p className="font-pixel text-2xl text-accentMagenta mb-4">{legendPassPrice || "—"}<span className="text-xs text-textDim">/mo</span></p>
            <p className="text-textDim text-xs mb-4">Everything in Power Pass, plus every Legend Pass game — the site's flagship, desktop-only experiences. Cancel anytime.</p>
            <p className="font-mono text-[10px] text-textDim mb-2 uppercase tracking-wide">{legendPassGames.length} games included</p>
            <ul className="text-[11px] text-textDim space-y-1 flex-1">
              {legendPassGames.slice(0, 8).map((g) => (
                <li key={g.slug}>{g.icon} {g.name}</li>
              ))}
              {legendPassGames.length > 8 && <li className="text-textDim/70">+ {legendPassGames.length - 8} more</li>}
            </ul>
            <Link href="/signup" className="mt-4 font-pixel text-[9px] text-center px-4 py-2.5 rounded-md text-bgDeep" style={{ background: "#ff3ea5" }}>
              GET LEGEND PASS ▸
            </Link>
          </div>
        </div>

        <p className="text-textDim text-xs mt-10">
          A one-time 24-hour full-access pass is also available for ₹10 from your account page after signing up.
          Questions about pricing or billing? See our <Link href="/terms" className="text-accentCyan underline">Terms</Link> or{" "}
          <Link href="/refund-policy" className="text-accentCyan underline">Refund Policy</Link>, or email{" "}
          <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>.
        </p>
      </div>
    </div>
  );
}
