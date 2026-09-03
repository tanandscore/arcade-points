import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";
import AdminTournamentsPanel from "@/components/admin/AdminTournamentsPanel";

export const metadata = {
  title: "Tournaments",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/tournaments" />
        <h1 className="font-pixel text-sm text-textLight mb-1">TOURNAMENTS</h1>
        <p className="text-textDim text-sm mb-8">
          Create weekly or monthly tournaments, pick which games are part of each one, and post announcements.
        </p>
        <AdminTournamentsPanel />
      </div>
    </div>
  );
}
