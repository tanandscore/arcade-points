import { redirect } from "next/navigation";
import { getChangelogEntries, markChangelogRead } from "@/lib/changelog";
import { getGames } from "@/lib/games";
import { getViewer } from "@/lib/viewer";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/store/PageHeader";
import CommunityTabs from "@/components/store/CommunityTabs";

export const metadata = {
  title: "What's New",
  alternates: { canonical: "/changelog" },
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function ChangelogPage() {
  const v = await getViewer();
  if (!v.user) redirect("/login?next=/changelog");
  const { supabase, user } = v;
  const [entries, games] = await Promise.all([getChangelogEntries(supabase), getGames()]);
  const nameOf = Object.fromEntries(games.map((g) => [g.slug, g.name]));

  // Visiting this page is the read signal itself — no separate
  // client-side call needed, since this is a server component and
  // the visit has already happened by the time this renders.
  await markChangelogRead(supabase, user.id);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <PageHeader title="What's new" sub="Real updates to the games and the site, as they ship." />
        <CommunityTabs active="news" />

        <div className="mt-8 max-w-3xl">
          {entries.length === 0 ? (
            <div className="st-band px-6 py-10 text-center">
              <p className="st-muted">Nothing published yet. Check back soon.</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {entries.map((entry) => (
                <li key={entry.id} className="st-band px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="st-h3" style={{ fontSize: "1.15rem" }}>{entry.title}</h2>
                    <time dateTime={entry.published_at} className="shrink-0 text-[13px] text-[#a99fd6]">{fmtDate(entry.published_at)}</time>
                  </div>
                  {entry.game_slug && <span className="st-chip mt-2.5">{nameOf[entry.game_slug] || entry.game_slug}</span>}
                  <p className="st-muted mt-2.5 whitespace-pre-line text-[15px] leading-relaxed">{entry.body}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
