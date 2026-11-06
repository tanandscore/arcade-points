import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/store/LegalPage";

export const metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  description: "About Tap & Score — who operates the site and what it is.",
};

const A = "st-doclink";

// Deliberately public, no auth check — this is where the site's
// legal operator name lives (moved here from the refund-policy page
// at the user's explicit request: it belongs with general site
// identity, not bundled into payment/refund terms).
export default function AboutPage() {
  return (
    <LegalPage title="About Tap & Score" lead="Who's behind the site.">
      <LegalSection id="operator" title="Operator">
        <p>Tap &amp; Score is operated by <strong>Rupam Sarmah</strong>.</p>
      </LegalSection>

      <LegalSection id="what" title="What this is">
        <p>
          A browser game platform — a growing library of full games with levels and progression: free 2D adventures and puzzles,
          deeper Power Pass games, and four flagship 3D games in Legend Pass. Real leaderboards, achievements, and a Hall of Fame
          for the platform&apos;s best players. No downloads, no installs.
        </p>
      </LegalSection>

      <LegalSection id="no-wagering" title="No wagering, no cash prizes">
        <p>
          Every game here is skill-based — your score reflects how well you play, not chance. Paid access is a
          flat monthly or yearly subscription, the same as buying an app
          or a streaming plan. Players never wager money against each other or the house, and the platform
          never pays out cash prizes or winnings. Competing for a spot on a leaderboard, an achievement, or the
          Hall of Fame is for recognition only — nothing here converts back into money.
        </p>
      </LegalSection>

      <LegalSection id="more" title="More">
        <p>
          See <Link href="/pricing" className={A}>Pricing &amp; Plans</Link>,{" "}
          <Link href="/terms" className={A}>Terms</Link>, or our{" "}
          <Link href="/refund-policy" className={A}>Refund &amp; Cancellation Policy</Link>. Questions? Email{" "}
          <a href="mailto:info@tapandscore.com" className={A}>info@tapandscore.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
