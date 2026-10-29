import Link from "next/link";
import Navbar from "@/components/Navbar";
import PassCompare from "@/components/store/PassCompare";
import { getGames, getComingSoon, getPassPlans } from "@/lib/games";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "Pricing and passes",
  alternates: { canonical: "/pricing" },
  description: "Tap & Score passes: Free games for everyone, Power Pass for deeper 2D games, and Legend Pass for the four flagship 3D games. Cancel any time.",
};

// Deliberately public, with no login wall: payment providers (and good manners) require that what each plan costs and includes is
// visible before anyone creates an account. A signed-in player sees real checkout buttons; a visitor is sent to sign up first.
export default async function PricingPage() {
  const [v, games, soon, plans] = await Promise.all([getViewer(), getGames(), getComingSoon(), getPassPlans()]);
  const notes = [
    ["Cancel any time", "Cancel from your account page. You keep access until the end of the period you already paid for."],
    ["Secure checkout", "Payments are handled by Fungies. Tap & Score never sees your card details."],
    ["Each pass builds on the last", "Power Pass includes every Free game. Legend Pass includes every Power Pass and Free game."],
  ];

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <header className="max-w-3xl">
          <h1 className="st-h1" style={{ fontSize: "clamp(2rem, 4.4vw, 3.1rem)" }}>Choose how far you want to go</h1>
          <p className="st-muted mt-3 text-[16px] leading-relaxed">
            Start free, then add a pass when you want bigger games. Subscriptions renew monthly or yearly. See our{" "}
            <Link href="/refund-policy" className="st-link">refund and cancellation policy</Link>.
          </p>
        </header>

        <div className="mt-9">
          <PassCompare games={games} soon={soon} plans={plans} userId={v.user?.id || null} current={v.isAdmin ? "legend" : v.tier} />
        </div>

        <ul className="mt-10 grid md:grid-cols-3 gap-4" aria-label="Good to know">
          {notes.map(([h, p]) => (
            <li key={h} className="st-band px-5 py-5">
              <h2 className="st-h3">{h}</h2>
              <p className="st-muted text-[14.5px] mt-1.5 leading-relaxed">{p}</p>
            </li>
          ))}
        </ul>

        <p className="st-muted text-[14px] mt-8">
          Questions about pricing or billing? Read the <Link href="/terms" className="st-link">terms</Link> or email{" "}
          <a href="mailto:info@tapandscore.com" className="st-link">info@tapandscore.com</a>.
        </p>
      </main>
    </div>
  );
}
