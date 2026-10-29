import { redirect } from "next/navigation";
import Link from "next/link";
import { getHallOfFame, HALL_OF_FAME_THRESHOLD } from "@/lib/leaderboard";
import { getViewer } from "@/lib/viewer";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/store/PageHeader";
import CommunityTabs from "@/components/store/CommunityTabs";
import RankMark from "@/components/store/RankMark";
import CountryTag from "@/components/CountryTag";

export const metadata = {
  title: "Hall of Fame",
  alternates: { canonical: "/hall-of-fame" },
};

export default async function HallOfFamePage() {
  const v = await getViewer();
  if (!v.user) redirect("/login?next=/hall-of-fame");
  const members = await getHallOfFame();

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <PageHeader
          title="Hall of Fame"
          sub={`Reserved for players who've earned ${HALL_OF_FAME_THRESHOLD.toLocaleString()}+ lifetime points across every game they've ever played. Not a single-session score, a career total.`}
        />
        <CommunityTabs active="hall" />

        <div className="mt-8 max-w-3xl">
          {members.length === 0 ? (
            <div className="st-band px-6 py-12 text-center">
              <p className="text-4xl" aria-hidden="true">🏛️</p>
              <p className="st-muted mx-auto mt-3 max-w-md">
                No one has reached the Hall of Fame yet. At this bar, it&apos;s a long-term achievement. Be the first name on the wall.
              </p>
              <Link href="/leaderboard" className="st-btn st-btn-ghost st-btn-sm mt-5">See the leaderboard</Link>
            </div>
          ) : (
            <ol className="st-panel divide-y divide-white/10 overflow-hidden" style={{ boxShadow: "inset 0 3px 0 #ffb703" }}>
              {members.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5 text-[15px]">
                  <RankMark rank={i + 1} />
                  <span className="flex min-w-0 flex-1 items-center">
                    <CountryTag code={m.country} />
                    {m.username ? (
                      <Link href={`/players/${encodeURIComponent(m.username)}`} className="truncate font-semibold text-[#f5f0ff] hover:underline">{m.username}</Link>
                    ) : (
                      <span className="truncate font-semibold text-[#f5f0ff]">player</span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums text-accentAmber">{(Number(m.lifetime_points) || 0).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
