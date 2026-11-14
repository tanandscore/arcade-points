import { TIERS } from "@/lib/catalog";

// The small pill that says which pass a game belongs to. The colour is the tier's own and is used for nothing else on the site.
export default function TierBadge({ tier, size = "sm", className = "" }) {
  const t = TIERS[tier];
  if (!t) return null;
  return (
    <span className={`st-tier ${size === "lg" ? "st-tier-lg" : ""} ${className}`} style={{ "--tc": t.color, "--tcb": `${t.color}99` }}>
      {t.name}
    </span>
  );
}
