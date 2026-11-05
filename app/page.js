import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import StoreHome, { STORE_FAQ } from "@/components/store/StoreHome";
import { getGames, getComingSoon, getPassPlans } from "@/lib/games";
import { getLeaderboardRows } from "@/lib/leaderboard";
import { getViewer } from "@/lib/viewer";

// The public front page: the same storefront a signed-in player sees, with a short welcome strip on top.
// Signed-in players never see this page; they go straight to their store.
export default async function LandingPage() {
  const v = await getViewer();
  if (v.user) redirect("/dashboard");

  const [games, soon, plans, board, { data: siteSettings }] = await Promise.all([
    getGames(),
    getComingSoon(),
    getPassPlans(),
    getLeaderboardRows("overall", 5).catch(() => []),
    v.supabase.from("site_settings").select("launch_countdown_at, launch_countdown_label").eq("id", 1).maybeSingle(),
  ]);
  const countdown = siteSettings?.launch_countdown_at && new Date(siteSettings.launch_countdown_at) > new Date()
    ? { at: siteSettings.launch_countdown_at, label: siteSettings.launch_countdown_label }
    : null;
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: STORE_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar username={null} points={0} isAdmin={false} />
      <StoreHome games={games} soon={soon} viewer={null} countdown={countdown} plans={plans} board={board} home="/" />
    </div>
  );
}
