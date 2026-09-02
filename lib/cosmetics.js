// Shown next to a subscriber's username on their profile and on
// leaderboard rows — a fixed catalog, same reasoning as avatars and
// themes.
export const COSMETIC_BADGES = [
  { id: "vip-crown", icon: "👑", label: "VIP" },
  { id: "elite-star", icon: "⭐", label: "Elite" },
  { id: "legend-flame", icon: "🔥", label: "Legend" },
  { id: "champion-medal", icon: "🏅", label: "Champion" },
  { id: "phantom-mask", icon: "🎭", label: "Phantom" },
  { id: "storm-bolt", icon: "⚡", label: "Storm" },
];

export function getCosmeticBadge(id) {
  return COSMETIC_BADGES.find((b) => b.id === id) || null;
}
