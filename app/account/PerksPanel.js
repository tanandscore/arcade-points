"use client";

import { useState } from "react";
import Link from "next/link";
import { AVATARS } from "@/lib/avatars";
import { THEMES } from "@/lib/themes";
import { COSMETIC_BADGES } from "@/lib/cosmetics";

export default function PerksPanel({ isSubscriber, currentAvatarId, currentThemeId, currentBadgeId }) {
  const [avatarId, setAvatarId] = useState(currentAvatarId || null);
  const [themeId, setThemeId] = useState(currentThemeId || "default");
  const [badgeId, setBadgeId] = useState(currentBadgeId || null);
  const [saving, setSaving] = useState(null); // which field is currently saving
  const [error, setError] = useState("");

  async function save(field, value, setter) {
    setSaving(field);
    setError("");
    const res = await fetch("/api/account/perks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) {
      setError(data.error || "Couldn't save.");
      return;
    }
    setter(value);
    if (field === "theme_id") window.location.reload(); // theme accent needs a fresh render to apply everywhere it's read server-side
  }

  if (!isSubscriber) {
    return (
      <div className="rounded-xl border border-lineColor bg-bgPanel p-6 text-center">
        <p className="text-3xl mb-3">👑</p>
        <p className="text-textDim text-sm mb-3">Subscribe to Power Pass or Legend Pass to unlock avatars, themes, and cosmetics.</p>
        <Link href="/pricing" className="font-pixel text-[10px] px-4 py-2.5 rounded-md bg-accentCyan text-bgDeep inline-block">
          SEE PLANS ▸
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-accentMagenta text-xs">{error}</p>}

      <div>
        <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-2">Animated Avatar</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save("avatar_id", null, setAvatarId)}
            disabled={saving === "avatar_id"}
            className="w-11 h-11 rounded-full border flex items-center justify-center text-textDim text-[9px] font-mono disabled:opacity-40"
            style={{ borderColor: !avatarId ? "#3ee6e0" : "rgba(169,159,214,0.3)" }}
          >
            None
          </button>
          {AVATARS.map((a) => (
            <button
              key={a.id}
              onClick={() => save("avatar_id", a.id, setAvatarId)}
              disabled={saving === "avatar_id"}
              className="w-11 h-11 rounded-full border flex items-center justify-center text-lg disabled:opacity-40"
              style={{ borderColor: avatarId === a.id ? a.color : "rgba(169,159,214,0.3)" }}
            >
              <span className={a.animationClass} style={{ color: a.color }}>
                {a.icon}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-2">Premium Theme (accent color)</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => save("theme_id", t.id, setThemeId)}
              disabled={saving === "theme_id"}
              className="px-3 py-2 rounded-md border font-mono text-[10px] disabled:opacity-40 flex items-center gap-2"
              style={{ borderColor: themeId === t.id ? t.accent : "rgba(169,159,214,0.3)", color: t.accent }}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: t.accent }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-2">Exclusive Cosmetic Badge</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save("cosmetic_badge", null, setBadgeId)}
            disabled={saving === "cosmetic_badge"}
            className="px-3 py-2 rounded-md border font-mono text-[10px] text-textDim disabled:opacity-40"
            style={{ borderColor: !badgeId ? "#3ee6e0" : "rgba(169,159,214,0.3)" }}
          >
            None
          </button>
          {COSMETIC_BADGES.map((b) => (
            <button
              key={b.id}
              onClick={() => save("cosmetic_badge", b.id, setBadgeId)}
              disabled={saving === "cosmetic_badge"}
              className="px-3 py-2 rounded-md border font-mono text-[10px] text-textLight disabled:opacity-40"
              style={{ borderColor: badgeId === b.id ? "#3ee6e0" : "rgba(169,159,214,0.3)" }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
