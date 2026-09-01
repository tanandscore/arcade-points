import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import AdminUserManagementPanel from "@/components/admin/AdminUserManagementPanel";

// Deliberately not linked from /admin or any nav — "hidden" here
// means undiscoverable through normal browsing, not less secure:
// the actual protection is the exact same isAdmin() gate as every
// other admin page, checked server-side before anything renders.
export const metadata = {
  title: "User Management",
  robots: { index: false, follow: false },
};

export default async function UserManagementPage() {
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">USER MANAGEMENT</h1>
        <p className="text-textDim text-sm mb-8">Search, create, delete, reset passwords, and see subscription status.</p>
        <AdminUserManagementPanel currentUserId={user.id} />
      </div>
    </div>
  );
}
