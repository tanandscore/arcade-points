import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import LiveActivityPanel from "@/components/admin/LiveActivityPanel";
import { getLiveActivity } from "@/lib/adminActivity";
import AdminNav from "@/components/admin/AdminNav";

// Deliberately not linked from /admin or any nav — same reasoning as
// /admin/user-management: "hidden" means undiscoverable through
// normal browsing, the real protection is the isAdmin() gate below.
export const metadata = {
  title: "Live Activity",
  robots: { index: false, follow: false },
};

export default async function LiveActivityPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const [{ data: profile }, activity] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    getLiveActivity(),
  ]);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/live-activity" />
        <h1 className="font-pixel text-sm text-textLight mb-1">LIVE ACTIVITY</h1>
        <p className="text-textDim text-sm mb-8">Who's active right now, and where they said they're from.</p>
        <LiveActivityPanel activity={activity} />
      </div>
    </div>
  );
}
