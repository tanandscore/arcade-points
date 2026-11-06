import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/store/PageHeader";
import FeedbackForm from "@/components/FeedbackForm";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage() {
  const v = await getViewer();
  if (!v.user) redirect("/login?next=/feedback");

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <PageHeader
          title="Send feedback"
          sub="Bugs, ideas, or anything on your mind. This goes straight to us, privately. It's never shown to other players or published anywhere."
        />
        <div className="mt-8 max-w-xl">
          <FeedbackForm />
        </div>
      </main>
    </div>
  );
}
