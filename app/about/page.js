import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  description: "About Tap & Score — who operates the site and what it is.",
};

// Deliberately public, no auth check — this is where the site's
// legal operator name lives (moved here from the refund-policy page
// at the user's explicit request: it belongs with general site
// identity, not bundled into payment/refund terms).
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
            ← Home
          </Link>
        }
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">ABOUT TAP & SCORE</h1>
        <p className="text-textDim text-sm mb-10">Who's behind the site.</p>

        <div className="space-y-8 text-sm text-textDim leading-relaxed">
          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">OPERATOR</h2>
            <p>Tap & Score is operated by <span className="text-textLight">Rupam Sarmah</span>.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">WHAT THIS IS</h2>
            <p>A browser arcade — a growing library of free and premium games, real leaderboards, achievements, and a Hall of Fame for the platform's best players. No downloads, no installs.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentMagenta mb-3">NO WAGERING, NO CASH PRIZES</h2>
            <p>
              Every game here is skill-based — your score reflects how well you play, not chance. Paid access is a
              fixed one-time purchase or a flat monthly subscription for the game itself, the same as buying an app
              or a streaming plan. Players never wager money against each other or the house, and the platform
              never pays out cash prizes or winnings. Competing for a spot on a leaderboard, an achievement, or the
              Hall of Fame is for recognition only — nothing here converts back into money.
            </p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">MORE</h2>
            <p>
              See <Link href="/pricing" className="text-accentCyan underline">Pricing & Plans</Link>,{" "}
              <Link href="/terms" className="text-accentCyan underline">Terms</Link>, or our{" "}
              <Link href="/refund-policy" className="text-accentCyan underline">Refund & Cancellation Policy</Link>. Questions? Email{" "}
              <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
