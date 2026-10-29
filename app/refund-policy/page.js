import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/store/LegalPage";
import { TERMS_DATE_TEXT } from "@/lib/compliance";

export const metadata = {
  title: "Refund & Cancellation Policy",
  alternates: { canonical: "/refund-policy" },
};

const A = "st-doclink";

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & cancellation policy" updated={TERMS_DATE_TEXT}>
      <LegalSection id="subscriptions" title="Pass subscriptions">
        <p>Each Pass (Power Pass, Legend Pass) is billed automatically every month or every year, depending on the plan you chose, until you cancel. You can cancel anytime from <Link href="/account" className={A}>Account Settings</Link> — you&apos;ll keep full access until the end of the billing period you&apos;ve already paid for, and you won&apos;t be charged again after that. We don&apos;t provide partial refunds for the remaining days of a period you cancel mid-cycle.</p>
      </LegalSection>

      <LegalSection id="payment-issues" title="Payment issues">
        <p>If you were charged incorrectly or a payment failed but you were still billed, contact us with your payment reference (visible in your Fungies confirmation email) and we&apos;ll investigate and refund where appropriate.</p>
      </LegalSection>

      <LegalSection id="how-refunds-work" title="How refunds are processed">
        <p>Approved refunds are issued back to your original payment method via Fungies, and typically reflect within 3–5 business days depending on your bank.</p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>Questions about a charge or cancellation? Email <a href="mailto:info@tapandscore.com" className={A}>info@tapandscore.com</a> or call <a href="tel:+917399372232" className={A}>+91 73993 72232</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
