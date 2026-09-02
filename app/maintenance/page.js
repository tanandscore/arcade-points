import { createServerSupabase } from "@/lib/supabaseServer";
import MaintenanceClient from "./MaintenanceClient";

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
    <div className="min-h-screen bg-bgDeep text-textLight flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-5">🛠️</p>
        <p className="font-pixel text-xs text-accentAmber mb-4">TAP & SCORE</p>
        <p className="text-textDim text-sm leading-relaxed">{message}</p>
        <MaintenanceClient from={from} />
      </div>
    </div>
  );
}
