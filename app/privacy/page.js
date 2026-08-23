import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
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
        <h1 className="font-pixel text-lg text-textLight mb-2">PRIVACY POLICY</h1>
        <p className="text-textDim text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-sm text-textDim leading-relaxed">
          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">WHAT WE COLLECT</h2>
            <p>When you create an account, we collect your email address, a username you choose, and (optionally) your country. As you play, we store your game scores and leaderboard rankings. If you make a purchase or subscribe, payment is handled entirely by Razorpay — we never see or store your card, UPI, or bank details.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">HOW WE USE IT</h2>
            <p>Your data is used to run your account, show your scores and rank on leaderboards, unlock games you've purchased or subscribed to, and respond if you contact support. We don't sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">WHO WE SHARE IT WITH</h2>
            <p>We use Supabase to host our database and handle account logins, and Razorpay to process payments. Both only receive the data necessary to provide their service to us — for example, Razorpay receives your payment details directly; we never do.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">COOKIES</h2>
            <p>We use essential cookies to keep you logged in between visits. We don't use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentCyan mb-3">YOUR CHOICES</h2>
            <p>You can update your username and country anytime from <Link href="/account" className="text-accentCyan underline">Account Settings</Link>. To request deletion of your account and data, email us — see below.</p>
          </section>

          <section>
            <h2 className="font-pixel text-[11px] text-accentAmber mb-3">CONTACT</h2>
            <p>Questions about your data? Email <a href="mailto:support@tapandscore.com" className="text-accentCyan underline">support@tapandscore.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
