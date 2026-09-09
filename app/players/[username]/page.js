import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getPublicProfile } from "@/lib/profile";
import { getGames } from "@/lib/games";
import Navbar from "@/components/Navbar";
import AchievementsPanel from "@/components/AchievementsPanel";
import { isAdmin } from "@/lib/admin";
import { getAvatar } from "@/lib/avatars";
import { getTheme } from "@/lib/themes";
import { getCosmeticBadge } from "@/lib/cosmetics";

export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `${username}'s profile`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicProfilePage({ params }) {
  const { username } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: viewerProfile }, profile, games] = await Promise.all([
    supabase.from("profiles").select("username, is_admin").eq("id", user.id).single(),
    getPublicProfile(username),
    getGames(),
  ]);
  if (!profile) notFound();

  const admin = viewerProfile?.is_admin || (await isAdmin(supabase, user.id));
  const gamesBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const isOwnProfile = viewerProfile?.username === profile.username;
  const avatar = getAvatar(profile.avatarId);
  const theme = profile.isVip ? getTheme(profile.themeId) : null;
  const badge = getCosmeticBadge(profile.cosmeticBadge);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={viewerProfile?.username || user.email} points={0} isAdmin={admin} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div
          className="rounded-xl border p-6 mb-8"
          style={
            theme
              ? { borderColor: theme.accent, borderWidth: 2, background: "#1d1046", boxShadow: `0 0 24px ${theme.glow}` }
              : { borderColor: "rgba(169,159,214,0.22)", background: "#1d1046" }
          }
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {avatar && (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl bg-bgPanel3 border" style={{ borderColor: avatar.color }}>
                  <span className={avatar.animationClass} style={{ color: avatar.color }}>
                    {avatar.icon}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-pixel text-lg text-textLight flex items-center gap-2 flex-wrap">
                  {profile.username}
                  {profile.isHallOfFame && <span title="Hall of Fame">🏛️</span>}
                  {profile.isVip && (
                    <span
                      className="font-mono text-[9px] px-2 py-0.5 rounded-full border"
                      style={{ borderColor: theme.accent, color: theme.accent }}
                    >
                      VIP
                    </span>
                  )}
                  {badge && (
                    <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-accentAmber text-accentAmber">
                      {badge.icon} {badge.label}
                    </span>
                  )}
                </h1>
                <p className="font-mono text-[11px] text-textDim mt-1">
                  Member since {new Date(profile.memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                </p>
                {profile.season && (
                  <p className="font-mono text-[11px] text-accentAmber mt-1.5">
                    {profile.season.badgeIcon} {profile.season.title} · {profile.season.name} · {profile.season.xp.toLocaleString()} season XP
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-pixel text-sm text-accentCyan">LEVEL {profile.xp.level}</p>
              <p className="font-mono text-[10px] text-textDim">{profile.xp.xp.toLocaleString()} XP</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden mt-4">
            <div className="h-full bg-accentCyan" style={{ width: `${Math.round(profile.xp.progress * 100)}%` }} />
          </div>
          {isOwnProfile && (
            <p className="font-mono text-[10px] text-textDim mt-3">This is how your profile looks to other players.</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label="Lifetime Points" value={profile.lifetimePoints.toLocaleString()} />
          <StatBox label="Games Played" value={`${profile.gamesPlayedCount}/${games.length}`} />
          <StatBox label="Current Streak" value={`${profile.currentStreak}d`} />
          <StatBox label="Longest Streak" value={`${profile.longestStreak}d`} />
          <StatBox label="Overall Rank" value={profile.overallRank ? `#${profile.overallRank}` : "Unranked"} />
        </div>

        {profile.recentlyPlayed.length > 0 && (
          <div className="mb-8">
            <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan mb-3">RECENTLY PLAYED</h2>
            <div className="flex flex-wrap gap-2">
              {profile.recentlyPlayed.map((row) => {
                const game = gamesBySlug[row.game];
                if (!game) return null;
                return (
                  <span key={row.game} className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-lineColor bg-bgPanel3 text-textLight">
                    {game.icon} {game.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <AchievementsPanel username={profile.username} />
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-lineColor bg-bgPanel p-3 text-center">
      <p className="font-pixel text-sm text-textLight">{value}</p>
      <p className="font-mono text-[9px] text-textDim mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}
