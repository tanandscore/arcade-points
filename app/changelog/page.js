import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";
import { getChangelogEntries, markChangelogRead } from "@/lib/changelog";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "What's New",
  alternates: { canonical: "/changelog" },
};

export default async function ChangelogPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const admin = await isAdmin(supabase, user.id);
  const entries = await getChangelogEntries(supabase);

  // Visiting this page is the read signal itself — no separate
  // client-side call needed, since this is a server component and
  // the visit has already happened by the time this renders.
  await markChangelogRead(supabase, user.id);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={profile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-lg text-accentAmber mb-2">WHAT&apos;S NEW</h1>
        <p className="text-textDim text-sm mb-8">Real updates to the games and the site, as they ship.</p>
        {entries.length === 0 && <p className="text-textDim text-sm">Nothing published yet — check back soon.</p>}
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-lineColor p-5 bg-bgPanel">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-pixel text-[11px] text-textLight">{entry.title}</h2>
                <span className="font-mono text-[10px] text-textDim shrink-0">
                  {new Date(entry.published_at).toLocaleDateString()}
                </span>
              </div>
              {entry.game_slug && (
                <span className="inline-block font-mono text-[9px] px-2 py-0.5 rounded-md border border-accentCyan text-accentCyan mb-2">
                  {entry.game_slug}
                </span>
              )}
              <p className="text-textDim text-sm leading-relaxed">{entry.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
