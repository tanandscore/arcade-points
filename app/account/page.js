import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import { isAdmin } from "@/lib/admin";
import AccountForm from "./AccountForm";

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

  const { data: profile } = await supabase.from("profiles").select("username, country, is_admin").eq("id", user.id).single();
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">ACCOUNT SETTINGS</h1>
        <p className="text-textDim text-sm mb-8">Your country is shown next to your name on leaderboards.</p>
        <AccountForm initialUsername={profile?.username || ""} initialCountry={profile?.country || ""} />
      </div>
    </div>
  );
}
