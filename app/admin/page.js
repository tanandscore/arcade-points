import { redirect } from "next/navigation";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import AdminFeedbackPanel from "@/components/admin/AdminFeedbackPanel";
import AdminOverviewPanel from "@/components/admin/AdminOverviewPanel";
import { getPlatformOverview } from "@/lib/adminOverview";
import AdminPerformancePanel from "@/components/admin/AdminPerformancePanel";
import { getPerformanceSummary } from "@/lib/adminPerformance";
import AdminBetaProgramPanel from "@/components/admin/AdminBetaProgramPanel";
import AdminSiteSettingsPanel from "@/components/admin/AdminSiteSettingsPanel";
import AdminGamesPanel from "@/components/admin/AdminGamesPanel";
import AdminNav from "@/components/admin/AdminNav";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();

  // Feedback has no user-facing select policy by design (see
  // migration_014) — the service role is the only thing that can
  // read it, which is exactly right for an admin-only page.
  const service = createServiceSupabase();
  const { data: feedback } = await service
    .from("feedback")
    .select("id, message, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(100);

  const overview = await getPlatformOverview();
  const performanceMetrics = await getPerformanceSummary(24);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin" />
        <h1 className="font-pixel text-sm text-textLight mb-1">PLATFORM OVERVIEW</h1>
        <p className="text-textDim text-sm mb-8">Real numbers only — no estimates that aren't clearly labeled as such.</p>
        <AdminOverviewPanel overview={overview} />

        <h2 className="font-pixel text-sm text-textLight mb-1 mt-12">PERFORMANCE</h2>
        <p className="text-textDim text-sm mb-8">Real browser-measured Web Vitals, collected site-wide.</p>
        <AdminPerformancePanel metrics={performanceMetrics} />

        <h2 className="font-pixel text-sm text-textLight mb-1 mt-12">BETA PROGRAM</h2>
        <p className="text-textDim text-sm mb-4">
          The next N new signups automatically get free full access for a set number of days — real feedback from
          real early users, no manual work per signup.
        </p>
        <AdminBetaProgramPanel />

        <h2 className="font-pixel text-sm text-textLight mb-1 mt-12">SITE STATUS</h2>
        <p className="text-textDim text-sm mb-4">Take the whole site down for updates, or bring it back.</p>
        <AdminSiteSettingsPanel />

        <h2 className="font-pixel text-sm text-textLight mb-1 mt-12">GAMES</h2>
        <p className="text-textDim text-sm mb-4">
          Show or hide any game, mark one under maintenance, or make a newly-built game admin-only while you test it.
        </p>
        <AdminGamesPanel />

        <h2 className="font-pixel text-sm text-textLight mb-1 mt-12">FEEDBACK</h2>
        <p className="text-textDim text-sm mb-6">Private — never shown to other users.</p>
        <AdminFeedbackPanel entries={feedback || []} />
      </div>
    </div>
  );
}
