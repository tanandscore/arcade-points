import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/store/LegalPage";
import { MIN_AGE, TERMS_DATE_TEXT } from "@/lib/compliance";

export const metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

const A = "st-doclink";

// [section id, heading]. The list at the side of the page and the sections below are both built from this, so they cannot drift apart.
const SECTIONS = [
  ["acceptance", "1. Acceptance of terms"],
  ["ip", "2. Intellectual property — ownership"],
  ["use", "3. Acceptable use"],
  ["accounts", "4. Accounts"],
  ["payments", "5. Payments & subscriptions"],
  ["disclaimer", "6. Disclaimer"],
  ["changes", "7. Changes to these terms"],
  ["contact", "8. Contact"],
];
const H = Object.fromEntries(SECTIONS);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated={TERMS_DATE_TEXT} toc={SECTIONS}>
      <LegalSection id="acceptance" title={H.acceptance}>
        <p>By creating an account or using Tap &amp; Score (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;), you agree to these Terms of Service. If you do not agree, please do not use the Service. Tap &amp; Score (tapandscore.com) is owned and operated by Rupam Sarmah, a sole proprietor.</p>
      </LegalSection>

      <LegalSection id="ip" title={H.ip}>
        <p>
          All games, game mechanics, source code, visual designs, characters, artwork, names, logos, and other
          content appearing on Tap &amp; Score are the original work of, and exclusive property of, Tap &amp; Score,
          except where explicitly licensed from a third party.
        </p>
        <p className="font-semibold text-[#f5f0ff]">
          No part of this Service — including but not limited to its games, code, designs, or written content —
          may be copied, reproduced, distributed, publicly displayed, modified, reverse-engineered, or used to
          create derivative works, in whole or in part, without our prior written permission.
        </p>
        <p>Unauthorized use may result in account termination and, where applicable, legal action.</p>
      </LegalSection>

      <LegalSection id="use" title={H.use}>
        <p>You agree not to: cheat, exploit bugs, or manipulate scores/leaderboards; abuse, harass, or impersonate other users; attempt to gain unauthorized access to accounts, admin functions, or the Service&apos;s infrastructure; or use automated tools (bots/scripts) to interact with the Service.</p>
      </LegalSection>

      <LegalSection id="accounts" title={H.accounts}>
        <p>You must be at least {MIN_AGE} years old to create an account. By creating one you confirm your age and agree to these Terms and our <Link href="/privacy" className={A}>Privacy Policy</Link>; we save the date of that agreement with your account.</p>
        <p>You&apos;re responsible for keeping your login credentials secure and for all activity under your account. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      </LegalSection>

      <LegalSection id="payments" title={H.payments}>
        <p>Monthly and yearly subscriptions are processed securely via Fungies. See our <Link href="/refund-policy" className={A}>Refund &amp; Cancellation Policy</Link> for details on refunds and cancelling a subscription.</p>
        <p>Our order process is conducted by our online reseller Fungies. Fungies is the Merchant of Record for all our orders. Fungies provides all customer service inquiries and handles returns.</p>
      </LegalSection>

      <LegalSection id="disclaimer" title={H.disclaimer}>
        <p>The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted or error-free operation. To the maximum extent permitted by law, Tap &amp; Score is not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>
      </LegalSection>

      <LegalSection id="changes" title={H.changes}>
        <p>We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
      </LegalSection>

      <LegalSection id="contact" title={H.contact}>
        <p>Questions about these Terms? Email us at <a href="mailto:info@tapandscore.com" className={A}>info@tapandscore.com</a> or call <a href="tel:+917399372232" className={A}>+91 73993 72232</a>. See our <Link href="/contact" className={A}>Contact page</Link> for more ways to reach us.</p>
      </LegalSection>
    </LegalPage>
  );
}
