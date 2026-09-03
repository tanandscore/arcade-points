// Scope note, stated honestly rather than overpromised: this site's
// core colors (bg/text/accent) are hardcoded hex values baked into
// Tailwind's generated CSS at build time, not CSS custom properties
// — retrofitting every one of the hundreds of existing className
// usages to reference swappable variables would be a large, risky
// refactor touching the whole codebase. Instead, "premium theme"
// here is a real, working accent color applied to specific
// theme-aware surfaces (the navbar glow, VIP profile styling) via a
// CSS variable those surfaces specifically read — genuine visual
// customization, just not a full site-wide palette swap.
export const THEMES = [
  { id: "default", name: "Classic", accent: "#3ee6e0", glow: "rgba(62,230,224,0.35)" },
  { id: "inferno", name: "Inferno", accent: "#ff5a3c", glow: "rgba(255,90,60,0.35)" },
  { id: "royal", name: "Royal", accent: "#b45cff", glow: "rgba(180,92,255,0.35)" },
  { id: "gold", name: "Gold", accent: "#ffd23f", glow: "rgba(255,210,63,0.35)" },
];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
