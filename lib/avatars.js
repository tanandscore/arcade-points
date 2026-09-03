// A fixed catalog, not free text — display code never has to handle
// an unknown id. Each is a real CSS-animated icon (pulse/spin/bounce/
// glow via Tailwind's built-in animation utilities plus one custom
// keyframe in globals.css) rather than a static emoji, since
// "animated avatar" was the actual ask, not "pick an emoji."
export const AVATARS = [
  { id: "pulse-cyan", icon: "🛡️", animationClass: "animate-pulse", color: "#3ee6e0" },
  { id: "spin-amber", icon: "⚡", animationClass: "animate-spin-slow", color: "#ffb703" },
  { id: "bounce-magenta", icon: "🎯", animationClass: "animate-bounce", color: "#ff3ea5" },
  { id: "glow-cyan", icon: "👑", animationClass: "animate-glow", color: "#3ee6e0" },
  { id: "pulse-magenta", icon: "🔥", animationClass: "animate-pulse", color: "#ff3ea5" },
  { id: "spin-cyan", icon: "🌀", animationClass: "animate-spin-slow", color: "#3ee6e0" },
  { id: "glow-amber", icon: "⭐", animationClass: "animate-glow", color: "#ffb703" },
  { id: "bounce-cyan", icon: "🚀", animationClass: "animate-bounce", color: "#3ee6e0" },
];

export function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) || null;
}
