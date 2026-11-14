import Link from "next/link";
import LegalPage from "@/components/store/LegalPage";

export const metadata = {
  title: "Contact Us",
  alternates: { canonical: "/contact" },
};

const A = "st-doclink";

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      lead="Tap & Score (tapandscore.com) is owned and operated by Rupam Sarmah, a sole proprietor based in India."
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <section className="st-panel p-5 sm:p-6">
          <h2 className="st-h3">Email</h2>
          <p className="mt-2 text-[17px]"><a href="mailto:info@tapandscore.com" className={A}>info@tapandscore.com</a></p>
          <p className="mt-2 text-[14.5px] leading-relaxed">
            For account issues, billing questions, refund requests, or anything else — this is the fastest way to reach us.
          </p>
        </section>

        <section className="st-panel p-5 sm:p-6">
          <h2 className="st-h3">Phone</h2>
          <p className="mt-2 text-[17px]"><a href="tel:+917399372232" className={A}>+91 73993 72232</a></p>
        </section>

        <section className="st-panel p-5 sm:p-6 sm:col-span-2">
          <h2 className="st-h3">Billing &amp; subscriptions</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed">
            Payments are processed by Fungies, our Merchant of Record. See our{" "}
            <Link href="/refund-policy" className={A}>Refund &amp; Cancellation Policy</Link> for
            details on refunds and cancelling a subscription, or our{" "}
            <Link href="/terms" className={A}>Terms of Service</Link> and{" "}
            <Link href="/privacy" className={A}>Privacy Policy</Link> for everything else.
          </p>
        </section>
      </div>
    </LegalPage>
  );
}
