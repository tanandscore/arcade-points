import { getGames } from "@/lib/games";

export default async function sitemap() {
  const now = new Date();
  const games = await getGames(); // defaults to excluding admin-test-only games — correct for a public sitemap
  const gameUrls = games.map((g) => ({
    url: `https://tapandscore.com/games/${g.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [
    { url: "https://tapandscore.com/", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: "https://tapandscore.com/login", lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://tapandscore.com/signup", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...gameUrls,
    { url: "https://tapandscore.com/terms", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://tapandscore.com/privacy", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://tapandscore.com/refund-policy", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
