import { createServerSupabase } from "@/lib/supabaseServer";

export const metadata = {
  title: "We'll be right back",
  robots: { index: false, follow: false },
};

// Reads the live message from site_settings so an admin can change
// the wording from /admin without a redeploy — if maintenance mode
// gets turned off while someone's on this page, they'll just see a
// normal page again on their next navigation (middleware stops
// redirecting here the moment the flag flips).
export default async function MaintenancePage() {
  const supabase = await createServerSupabase();
  const { data: settings } = await supabase.from("site_settings").select("maintenance_message").eq("id", 1).maybeSingle();
  const message = settings?.maintenance_message || "Game engine updating — we'll be shortly back.";

  return (
    <div className="min-h-screen bg-bgDeep text-textLight flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-5">🛠️</p>
        <p className="font-pixel text-xs text-accentAmber mb-4">TAP & SCORE</p>
        <p className="text-textDim text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
