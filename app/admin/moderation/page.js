import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";
import AdminModerationPanel from "@/components/admin/AdminModerationPanel";
import { getAdminContext } from "@/lib/adminPage";

export const metadata = { title: "Moderation", robots: { index: false, follow: false } };

export default async function Page() {
  const { username } = await getAdminContext();
  return (
    <div className="min-h-screen text-textLight pb-20 sm:pb-0">
      <Navbar username={username} points={0} isAdmin={true} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/moderation" />
        <h1 className="font-display font-bold text-3xl mb-1">Moderation</h1>
        <p className="text-textDim text-sm mb-8">Find a player, suspend their scores or remove a score that looks wrong. Every action is logged.</p>
        <AdminModerationPanel />
      </div>
    </div>
  );
}
