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
    .select("id, message, status, admin_note, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(100);

  let feedbackRows = feedback;
  if (!feedbackRows) {
    const { data: older } = await service.from("feedback").select("id, message, created_at, profiles(username)").order("created_at", { ascending: false }).limit(100);
    feedbackRows = older;
  }
  // Signups per day for the last 14 days, from real profile rows.
  const since = new Date(Date.now() - 14 * 86400000); since.setHours(0, 0, 0, 0);
  const { data: recent } = await service.from("profiles").select("created_at").gte("created_at", since.toISOString()).limit(5000);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(since.getTime() + i * 86400000); return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), n: 0 }; });
  for (const r of recent || []) { const k = new Date(r.created_at).toISOString().slice(0, 10); const d = days.find((x) => x.key === k); if (d) d.n++; }
  const maxN = Math.max(1, ...days.map((d) => d.n)); const total14 = days.reduce((a, d) => a + d.n, 0);
  const { count: suspended } = await service.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true);
  const overview = await getPlatformOverview();
  const performanceMetrics = await getPerformanceSummary(24);

  return (
    <div className="admin-bg min-h-screen pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="admin-light max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin" />
        <h1 className="font-display font-bold text-3xl mb-1">Platform overview</h1>
        <p className="text-textDim text-sm mb-8">Real numbers only. Anything estimated is labelled.</p>
        <AdminOverviewPanel overview={overview} />

        <h2 className="font-display font-bold text-xl mb-1 mt-12">New signups, last 14 days</h2>
        <p className="text-textDim text-sm mb-4">{total14.toLocaleString()} new players in two weeks{suspended ? ` · ${suspended} suspended` : ""}.</p>
        <div className="ap-card p-5">
          <div className="flex items-end gap-1.5 h-32" role="img" aria-label="Signups per day">
            {days.map((d) => (<div key={d.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full"><span className="text-[10px] font-mono text-textDim">{d.n || ""}</span><div className="w-full rounded-t" style={{ height: `${Math.max(3, (d.n / maxN) * 100)}%`, background: d.n ? "linear-gradient(180deg,#3ee6e0,#2a8fb5)" : "rgba(255,255,255,0.08)" }} /></div>))}
          </div>
          <div className="flex gap-1.5 mt-2">{days.map((d, i) => <span key={d.key} className="flex-1 text-center text-[9px] text-textDim">{i % 2 === 0 ? d.label : ""}</span>)}</div>
        </div>

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Downloads</h2>
        <p className="text-textDim text-sm mb-4">CSV files for your own spreadsheets. They never include emails or passwords.</p>
        <div className="flex flex-wrap gap-2">
          {[["players", "Players"], ["scores", "Scores"], ["feedback", "Feedback"], ["audit", "Audit log"]].map(([k, l]) => <a key={k} href={`/api/admin/export?type=${k}`} className="ap-btn ap-btn-ghost text-sm !py-2.5">{l} (CSV)</a>)}
        </div>

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Performance</h2>
        <p className="text-textDim text-sm mb-8">Real browser-measured Web Vitals, collected site-wide.</p>
        <AdminPerformancePanel metrics={performanceMetrics} />

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Beta program</h2>
        <p className="text-textDim text-sm mb-4">
          The next N new signups automatically get free full access for a set number of days — real feedback from
          real early users, no manual work per signup.
        </p>
        <AdminBetaProgramPanel />

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Site status</h2>
        <p className="text-textDim text-sm mb-4">Take the whole site down for updates, or bring it back.</p>
        <AdminSiteSettingsPanel />

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Games</h2>
        <p className="text-textDim text-sm mb-4">
          Show or hide any game, mark one under maintenance, or make a newly-built game admin-only while you test it.
        </p>
        <AdminGamesPanel />

        <h2 className="font-display font-bold text-xl mb-1 mt-12">Feedback inbox</h2>
        <p className="text-textDim text-sm mb-6">Private — never shown to other users.</p>
        <AdminFeedbackPanel entries={feedbackRows || []} />
      </div>
    </div>
  );
}
