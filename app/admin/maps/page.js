import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";
import MapSwitchboard from "@/components/admin/MapSwitchboard";

export const metadata = { title: "Map switches", robots: { index: false, follow: false } };

export default async function MapsAdminPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/maps" />
        <h1 className="font-pixel text-sm text-textLight mb-1">MAP SWITCHES</h1>
        <p className="text-textDim text-sm mb-8">Turn single maps on or off inside a game. The game itself stays live. Players see the change the next time they open the game&apos;s map screen.</p>
        <MapSwitchboard />
      </div>
    </div>
  );
}
