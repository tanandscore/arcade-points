import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight">
            ← Home
          </Link>
        }
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">TERMS OF SERVICE</h1>
        <p className="text-textDim text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-sm text-textDim leading-relaxed">
          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">1. ACCEPTANCE OF TERMS</h2>
            <p>By creating an account or using Tap & Score ("the Service", "we", "us"), you agree to these Terms of Service. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">2. INTELLECTUAL PROPERTY — OWNERSHIP</h2>
            <p className="mb-2">
              All games, game mechanics, source code, visual designs, characters, artwork, names, logos, and other
              content appearing on Tap & Score are the original work of, and exclusive property of, Tap & Score,
              except where explicitly licensed from a third party.
            </p>
            <p className="font-semibold text-textLight">
              No part of this Service — including but not limited to its games, code, designs, or written content —
              may be copied, reproduced, distributed, publicly displayed, modified, reverse-engineered, or used to
              create derivative works, in whole or in part, without our prior written permission.
            </p>
            <p className="mt-2">Unauthorized use may result in account termination and, where applicable, legal action.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">3. ACCEPTABLE USE</h2>
            <p>You agree not to: cheat, exploit bugs, or manipulate scores/leaderboards; abuse, harass, or impersonate other users; attempt to gain unauthorized access to accounts, admin functions, or the Service's infrastructure; or use automated tools (bots/scripts) to interact with the Service.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">4. ACCOUNTS</h2>
            <p>You're responsible for keeping your login credentials secure and for all activity under your account. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">5. PAYMENTS & SUBSCRIPTIONS</h2>
            <p>One-time game purchases and monthly subscriptions are processed securely via PayU. See our <Link href="/refund-policy" className="text-accentCyan underline">Refund & Cancellation Policy</Link> for details on refunds and cancelling a subscription.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">6. DISCLAIMER</h2>
            <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation. To the maximum extent permitted by law, Tap & Score is not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">7. CHANGES TO THESE TERMS</h2>
            <p>We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">8. CONTACT</h2>
            <p>Questions about these Terms? Email us at <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
