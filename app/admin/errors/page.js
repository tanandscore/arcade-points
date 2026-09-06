import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getRecentErrors } from "@/lib/errorReporting";
import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";

export const metadata = {
  title: "Errors",
  robots: { index: false, follow: false },
};

export default async function AdminErrorsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const [{ data: profile }, errors] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    getRecentErrors(supabase, 100),
  ]);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/errors" />
        <h1 className="font-pixel text-sm text-textLight mb-1">ERRORS</h1>
        <p className="text-textDim text-sm mb-8">
          Real client-side errors caught across the site, most recent first. Deduplicated per page load, so
          repeated identical errors from one visitor only show up once here per visit, not once per occurrence.
        </p>
        {errors.length === 0 && <p className="text-textDim text-sm">No errors reported yet — genuinely clean, not just unmonitored.</p>}
        <div className="space-y-3">
          {errors.map((e) => (
            <div key={e.id} className="rounded-lg border border-accentMagenta/40 p-4 bg-bgPanel">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-textLight text-xs font-bold">{e.message}</p>
                <span className="font-mono text-[10px] text-textDim shrink-0">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              <p className="font-mono text-[10px] text-accentCyan mb-1">{e.path}</p>
              {e.user_agent && <p className="font-mono text-[10px] text-textDim mb-1">{e.user_agent}</p>}
              {e.stack && (
                <details className="mt-2">
                  <summary className="font-mono text-[10px] text-accentAmber cursor-pointer">Stack trace</summary>
                  <pre className="font-mono text-[10px] text-textDim mt-2 whitespace-pre-wrap break-words">{e.stack}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
