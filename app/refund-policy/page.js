import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = {
  title: "Refund & Cancellation Policy",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
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
        <h1 className="font-pixel text-lg text-textLight mb-2">REFUND & CANCELLATION POLICY</h1>
        <p className="text-textDim text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-sm text-textDim leading-relaxed">
          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">ONE-TIME GAME PURCHASES</h2>
            <p>One-time purchases unlock a game immediately and are generally non-refundable once access has been granted. If a payment was taken but the game did not unlock due to a technical issue on our end, contact support and we'll fix it or refund you.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">PREMIUM SUBSCRIPTION</h2>
            <p className="mb-2">Each Pass (Power Pass, Legend Pass) is billed automatically every month until you cancel. You can cancel anytime from <Link href="/account" className="text-accentCyan underline">Account Settings</Link> — you'll keep full access until the end of the billing period you've already paid for, and you won't be charged again after that. We don't provide partial refunds for the remaining days of a period you cancel mid-cycle.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">PAYMENT ISSUES</h2>
            <p>If you were charged incorrectly or a payment failed but you were still billed, contact us with your payment reference (visible in your PayU confirmation email) and we'll investigate and refund where appropriate.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">HOW REFUNDS ARE PROCESSED</h2>
            <p>Approved refunds are issued back to your original payment method via PayU, and typically reflect within 5–7 business days depending on your bank.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">CONTACT</h2>
            <p>Questions about a charge or cancellation? Email <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
