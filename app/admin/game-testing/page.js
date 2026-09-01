import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import { getGames } from "@/lib/games";

// Deliberately not linked from /admin or any nav — same reasoning as
// the other hidden admin pages. A game listed here is fully live and
// playable (see app/games/[slug]/page.js's admin_test_only check),
// just invisible to everyone except admins until toggled public from
// the GAMES panel on /admin.
export const metadata = {
  title: "Game Testing",
  robots: { index: false, follow: false },
};

export default async function GameTestingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const [{ data: profile }, allGames] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    getGames({ includeTestOnly: true }),
  ]);
  const testGames = allGames.filter((g) => g.adminTestOnly);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-sm text-textLight mb-1">GAME TESTING</h1>
        <p className="text-textDim text-sm mb-8">
          Games marked admin-only from the GAMES panel on /admin — fully playable, invisible to everyone else.
        </p>

        {testGames.length === 0 ? (
          <p className="text-textDim text-sm">
            Nothing in testing right now. Mark a game "admin-only" from the GAMES panel on the main admin page to
            have it appear here.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {testGames.map((game) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="rounded-xl border border-accentCyan/50 bg-bgPanel p-5 hover:-translate-y-0.5 transition-transform"
              >
                <p className="font-pixel text-sm mb-1" style={{ color: game.accentColor }}>
                  {game.icon} {game.name}
                </p>
                <p className="text-textDim text-xs">{game.tagline}</p>
                <p className="font-mono text-[9px] text-accentCyan mt-2">TEST ONLY — click to play</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
