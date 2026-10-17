import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";
import { getAdminContext } from "@/lib/adminPage";

export const metadata = { title: "Audit log", robots: { index: false, follow: false } };

const LABELS = { "site.settings": "Changed site settings", "game.update": "Changed a game", "user.delete": "Deleted a user", "user.password_reset": "Reset a password", "player.suspend": "Suspended a player", "player.unsuspend": "Restored a player", "score.delete": "Removed a score", "announcement.create": "Published an announcement", "announcement.show": "Showed an announcement", "announcement.hide": "Hid an announcement", "announcement.delete": "Deleted an announcement", "feedback.update": "Updated feedback", "feedback.delete": "Deleted feedback" };

export default async function Page() {
  const { username, service } = await getAdminContext();
  const { data, error } = await service.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="min-h-screen text-textLight pb-20 sm:pb-0">
      <Navbar username={username} points={0} isAdmin={true} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/audit-log" />
        <div className="flex items-end justify-between gap-4 mb-1"><h1 className="font-display font-bold text-3xl">Audit log</h1><a href="/api/admin/export?type=audit" className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Download CSV</a></div>
        <p className="text-textDim text-sm mb-8">The last 200 admin actions: who did what, and when.</p>
        {error && <p className="text-sm text-accentMagenta">Couldn&apos;t read the log. Run migration 075 in Supabase first.</p>}
        {data && data.length === 0 && <p className="text-sm text-textDim">Nothing logged yet. Actions you take in the admin area will appear here.</p>}
        <div className="ap-card overflow-hidden">
          {(data || []).map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-lineColor/50 last:border-0 grid sm:grid-cols-[170px_1fr] gap-1 sm:gap-4">
              <span className="text-xs text-textDim">{new Date(r.created_at).toLocaleString()}</span>
              <div><p className="text-sm"><span className="font-semibold">{r.admin_name || "admin"}</span> · {LABELS[r.action] || r.action}{r.target ? <span className="text-textDim"> · {r.target}</span> : null}</p>{r.details && <p className="font-mono text-[11px] text-textDim mt-0.5 break-all">{JSON.stringify(r.details)}</p>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
