import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = {
  title: "Contact Us",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
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
        <h1 className="font-pixel text-lg text-textLight mb-2">CONTACT US</h1>
        <p className="text-textDim text-sm mb-10">
          Tap & Score (tapandscore.com) is owned and operated by Rupam Sarmah, a sole proprietor based in India.
        </p>

        <div className="space-y-8 text-sm text-textDim leading-relaxed">
          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">EMAIL</h2>
            <p>
              <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>
              <br />
              For account issues, billing questions, refund requests, or anything else — this is the fastest way to reach us.
            </p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">PHONE</h2>
            <p>
              <a href="tel:+917399372232" className="text-accentCyan underline">+91 73993 72232</a>
            </p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">BILLING & SUBSCRIPTIONS</h2>
            <p>
              Payments are processed by Paddle.com, our Merchant of Record. See our{" "}
              <Link href="/refund-policy" className="text-accentCyan underline">Refund & Cancellation Policy</Link> for
              details on refunds and cancelling a subscription, or our{" "}
              <Link href="/terms" className="text-accentCyan underline">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="text-accentCyan underline">Privacy Policy</Link> for everything else.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
