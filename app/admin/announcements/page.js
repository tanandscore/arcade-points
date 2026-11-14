import Navbar from "@/components/Navbar";
import AdminNav from "@/components/admin/AdminNav";
import AdminAnnouncementsPanel from "@/components/admin/AdminAnnouncementsPanel";
import { getAdminContext } from "@/lib/adminPage";

export const metadata = { title: "Announcements", robots: { index: false, follow: false } };

export default async function Page() {
  const { username } = await getAdminContext();
  return (
    <div className="admin-bg min-h-screen pb-20 sm:pb-0">
      <Navbar username={username} points={0} isAdmin={true} />
      <div className="admin-light max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <AdminNav active="/admin/announcements" />
        <h1 className="font-display font-bold text-3xl mb-1">Announcements</h1>
        <p className="text-textDim text-sm mb-8">A banner above every page for news, offers or warnings, with an optional schedule.</p>
        <AdminAnnouncementsPanel />
      </div>
    </div>
  );
}
