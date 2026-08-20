import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getHallOfFame, HALL_OF_FAME_THRESHOLD } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import CountryTag from "@/components/CountryTag";

export const metadata = {
  title: "Hall of Fame",
  alternates: { canonical: "/hall-of-fame" },
};

export default async function HallOfFamePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const admin = await isAdmin(supabase, user.id);
  const members = await getHallOfFame();

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="text-4xl mb-3">🏛️</div>
        <h1 className="font-pixel text-lg text-accentAmber mb-3">HALL OF FAME</h1>
        <p className="text-textDim text-sm mb-10 max-w-md mx-auto">
          Reserved for players who've earned {HALL_OF_FAME_THRESHOLD.toLocaleString()}+ lifetime points across every
          game they've ever played — not a single-session score, a career total.
        </p>

        {members.length === 0 ? (
          <div className="rounded-xl border border-lineColor bg-bgPanel p-10">
            <p className="text-textDim text-sm">
              No one has reached the Hall of Fame yet. At this bar, it's a long-term achievement — be the first name
              on the wall.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-accentAmber bg-bgPanel overflow-hidden text-left">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-5 py-3 border-b border-lineColor last:border-0 font-mono text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="text-accentAmber w-8">#{i + 1}</span>
                  <CountryTag code={m.country} />
                  <span className="text-textLight">{m.username || "player"}</span>
                </span>
                <span className="text-accentAmber">{Number(m.lifetime_points).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <Link href="/leaderboard" className="inline-block mt-8 font-mono text-xs text-accentCyan">
          ← Back to the regular leaderboard
        </Link>
      </div>
    </div>
  );
}
