import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";

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

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">USER MANAGEMENT</h1>
        <p className="text-textDim text-sm mb-8">Add, remove, or reset passwords for any account.</p>
        <AdminUsersPanel currentUserId={user.id} />
      </div>
    </div>
  );
}
