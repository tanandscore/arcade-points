import { createServerSupabase } from "@/lib/supabaseServer";
import MaintenanceClient from "@/components/MaintenanceClient";

export const metadata = {
  title: "We'll be right back",
  robots: { index: false, follow: false },
};

// Reads the live message from site_settings so an admin can change
// the wording from /admin without a redeploy. Actually getting a
// person back to the live site once maintenance ends — not just
// stopping the redirect on their NEXT navigation — is handled by
// MaintenanceClient below (polling + auto-redirect to `from`, the
// page middleware caught them on their way to).
export default async function MaintenancePage({ searchParams }) {
  const { from } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: settings } = await supabase.from("site_settings").select("maintenance_message").eq("id", 1).maybeSingle();
  const message = settings?.maintenance_message || "Game engine updating — we'll be shortly back.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgDeep px-4 text-textLight">
      <div className="max-w-sm text-center">
        <p className="st-logo" style={{ fontSize: 14 }}>TAP<b>&amp;</b>SCORE</p>
        <h1 className="st-h1 mt-6" style={{ fontSize: "2rem" }}>We&apos;ll be right back</h1>
        <p className="st-muted mt-3 text-[15.5px] leading-relaxed">{message}</p>
        <MaintenanceClient from={from} />
      </div>
    </div>
  );
}
