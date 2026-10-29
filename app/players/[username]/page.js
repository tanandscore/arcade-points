import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profile";
import { getGames } from "@/lib/games";
import { getViewer } from "@/lib/viewer";
import Navbar from "@/components/Navbar";
import AchievementsPanel from "@/components/AchievementsPanel";
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
  const v = await getViewer();
  if (!v.user) redirect(/^[\w.-]{1,32}$/.test(username) ? `/login?next=${encodeURIComponent(`/players/${username}`)}` : "/login");

  const [profile, games] = await Promise.all([getPublicProfile(username), getGames()]);
  if (!profile) notFound();

  const gamesBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const isOwnProfile = v.profile?.username === profile.username;
  const avatar = getAvatar(profile.avatarId);
  const theme = profile.isVip ? getTheme(profile.themeId) : null;
  const badge = getCosmeticBadge(profile.cosmeticBadge);

  const stats = [
    ["Lifetime points", profile.lifetimePoints.toLocaleString()],
    ["Games played", `${profile.gamesPlayedCount} of ${games.length}`],
    ["Current streak", `${profile.currentStreak} ${profile.currentStreak === 1 ? "day" : "days"}`],
    ["Longest streak", `${profile.longestStreak} ${profile.longestStreak === 1 ? "day" : "days"}`],
    ["Overall rank", profile.overallRank ? `#${profile.overallRank.toLocaleString()}` : "Unranked"],
  ];

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <div className="max-w-4xl">
          <section
            className="st-panel p-5 sm:p-7"
            style={theme ? { borderColor: theme.accent, borderWidth: 2, background: "#1d1046", boxShadow: `0 0 24px ${theme.glow}` } : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                {avatar && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 bg-white/5 text-3xl" style={{ borderColor: avatar.color }}>
                    <span className={avatar.animationClass} style={{ color: avatar.color }}>
                      {avatar.icon}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="st-h1 flex flex-wrap items-center gap-x-3 gap-y-1.5" style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.2rem)" }}>
                    <span className="break-all">{profile.username}</span>
                    {profile.isHallOfFame && <span title="Hall of Fame" className="text-[1.4rem]">🏛️</span>}
                    {profile.isVip && theme && (
                      <span className="st-chip" style={{ borderColor: theme.accent, color: theme.accent }}>VIP</span>
                    )}
                    {badge && (
                      <span className="st-chip !border-accentAmber/60 !text-accentAmber">
                        {badge.icon} {badge.label}
                      </span>
                    )}
                  </h1>
                  <p className="st-muted mt-1.5 text-[14px]">
                    Member since {new Date(profile.memberSince).toLocaleDateString("en-GB", { year: "numeric", month: "long" })}
                  </p>
                  {profile.season && (
                    <p className="mt-1.5 text-[14px] text-accentAmber">
                      {profile.season.badgeIcon} {profile.season.title} · {profile.season.name} · {profile.season.xp.toLocaleString()} season XP
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="st-h2 text-accentCyan">Level {profile.xp.level}</p>
                <p className="text-[13px] tabular-nums text-[#a99fd6]">{profile.xp.xp.toLocaleString()} XP</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accentCyan" style={{ width: `${Math.round(profile.xp.progress * 100)}%` }} />
            </div>
            {isOwnProfile && (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[13.5px] text-[#a99fd6]">
                This is how your profile looks to other players.
                <Link href="/account" className="st-link">Edit your account</Link>
              </p>
            )}
          </section>

          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Stats">
            {stats.map(([label, value]) => (
              <li key={label} className="st-band col-span-1 px-4 py-4 max-sm:last:col-span-2">
                <p className="st-h2 tabular-nums" style={{ fontSize: "1.3rem" }}>{value}</p>
                <p className="mt-1 text-[13px] text-[#c3bbea]">{label}</p>
              </li>
            ))}
          </ul>

          {profile.recentlyPlayed.length > 0 && (
            <section className="mt-9" aria-label="Recently played">
              <h2 className="st-h2 mb-3">Recently played</h2>
              <div className="flex flex-wrap gap-2">
                {profile.recentlyPlayed.map((row) => {
                  const game = gamesBySlug[row.game];
                  if (!game) return null;
                  return (
                    <Link key={row.game} href={`/games/${game.slug}`} className="st-chip st-chip-btn !h-9 !px-4 !text-[14px]">
                      <span className="mr-2">{game.icon}</span>{game.name}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mt-9">
            <AchievementsPanel username={profile.username} />
          </div>
        </div>
      </main>
    </div>
  );
}
