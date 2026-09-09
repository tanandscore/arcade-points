import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import FeedbackForm from "./FeedbackForm";

export const metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username, is_admin").eq("id", user.id).single();
  const admin = profile?.is_admin || (await isAdmin(supabase, user.id));

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">SEND FEEDBACK</h1>
        <p className="text-textDim text-sm mb-8">
          Bugs, ideas, or anything on your mind — this goes straight to us, privately. It's never shown to other
          players or published anywhere.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
