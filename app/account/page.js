import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import AccountForm from "./AccountForm";
import ReferralBox from "./ReferralBox";
import SubscriptionBox from "./SubscriptionBox";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, country, is_admin, is_premium, referral_code, bonus_subscription_until")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status, plan_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">ACCOUNT SETTINGS</h1>
        <p className="text-textDim text-sm mb-8">Your country is shown next to your name on leaderboards.</p>
        <AccountForm initialUsername={profile?.username || ""} initialCountry={profile?.country || ""} />

        {subscription?.status === "active" && (
          <div className="mt-8">
            <SubscriptionBox subscription={subscription} />
          </div>
        )}

        <div className="mt-8">
          <ReferralBox referralCode={profile?.referral_code} bonusUntil={profile?.bonus_subscription_until} />
        </div>

        <div className="mt-10 pt-6 border-t border-lineColor text-center font-mono text-[11px] text-textDim flex justify-center gap-4">
          <Link href="/terms" className="text-accentCyan">Terms</Link>
          <Link href="/privacy" className="text-accentCyan">Privacy</Link>
          <Link href="/refund-policy" className="text-accentCyan">Refunds</Link>
          <a href="mailto:support@tapandscore.com" className="text-accentCyan">Contact</a>
        </div>
      </div>
    </div>
  );
}
