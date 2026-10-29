"use client";

import { useState } from "react";
import Link from "next/link";
import { AVATARS, getAvatar } from "@/lib/avatars";
import { THEMES, getTheme } from "@/lib/themes";
import { COSMETIC_BADGES, getCosmeticBadge } from "@/lib/cosmetics";

export default function PerksPanel({ isSubscriber, currentAvatarId, currentThemeId, currentBadgeId, username }) {
  const [avatarId, setAvatarId] = useState(currentAvatarId || null);
  const [themeId, setThemeId] = useState(currentThemeId || "default");
  const [badgeId, setBadgeId] = useState(currentBadgeId || null);
  const [saving, setSaving] = useState(null); // which field is currently saving
  const [error, setError] = useState("");

  async function save(field, value, setter) {
    setSaving(field);
    setError("");
    let res, data = {};
    try {
      res = await fetch("/api/account/perks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      setSaving(null);
      setError("Couldn't reach the server — check your connection and try again.");
      return;
    }
    setSaving(null);
    if (!res.ok) {
      setError(data.error || `Couldn't save (error ${res.status}).`);
      return;
    }
    setter(value);
    if (field === "theme_id") window.location.reload(); // theme accent needs a fresh render to apply everywhere it's read server-side
  }

  if (!isSubscriber) {
    return (
      <div className="st-panel p-6 text-center">
        <p className="text-3xl mb-3" aria-hidden>👑</p>
        <p className="st-muted text-[14.5px] mb-4 max-w-[44ch] mx-auto">Subscribe to Power Pass or Legend Pass to unlock avatars, themes and cosmetics.</p>
        <Link href="/pricing" className="st-btn st-btn-primary st-btn-sm">See the passes</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-accentMagenta text-[13.5px]">{error}</p>}

      {(() => {
        const av = getAvatar(avatarId);
        const th = getTheme(themeId);
        const bd = getCosmeticBadge(badgeId);
        return (
          <div className="st-panel p-5" style={{ boxShadow: `inset 0 0 0 2px ${th.accent}, 0 0 24px ${th.glow}` }}>
            <p className="st-muted text-[13px] mb-3">Your look: this is how other players see you.</p>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl bg-bgPanel3 border" style={{ borderColor: av ? av.color : "rgba(169,159,214,0.3)" }}>
                {av ? <span className={av.animationClass} style={{ color: av.color }}>{av.icon}</span> : <span className="text-textDim text-xs">?</span>}
              </div>
              <div>
                <p className="st-h3 mb-1.5">{username || "You"}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="st-chip" style={{ borderColor: th.accent, color: th.accent }}>{th.name} theme</span>
                  {bd && <span className="text-[13px] text-textLight">{bd.icon} {bd.label}</span>}
                </div>
              </div>
            </div>
            {username && (
              <Link href={`/players/${encodeURIComponent(username)}`} className="st-link inline-block mt-3 text-[13.5px]">
                See it on my public profile
              </Link>
            )}
          </div>
        );
      })()}

      <div>
        <p className="st-label">Animated avatar</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save("avatar_id", null, setAvatarId)}
            disabled={saving === "avatar_id"}
            className="w-11 h-11 rounded-full border flex items-center justify-center text-textDim text-[11px] font-semibold disabled:opacity-40"
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
        <p className="st-label">Premium theme (accent colour)</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => save("theme_id", t.id, setThemeId)}
              disabled={saving === "theme_id"}
              className="px-3.5 py-2 rounded-lg border text-[13px] font-semibold disabled:opacity-40 flex items-center gap-2"
              style={{ borderColor: themeId === t.id ? t.accent : "rgba(169,159,214,0.3)", color: t.accent }}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: t.accent }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="st-label">Exclusive badge</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save("cosmetic_badge", null, setBadgeId)}
            disabled={saving === "cosmetic_badge"}
            className="px-3.5 py-2 rounded-lg border text-[13px] font-semibold text-textDim disabled:opacity-40"
            style={{ borderColor: !badgeId ? "#3ee6e0" : "rgba(169,159,214,0.3)" }}
          >
            None
          </button>
          {COSMETIC_BADGES.map((b) => (
            <button
              key={b.id}
              onClick={() => save("cosmetic_badge", b.id, setBadgeId)}
              disabled={saving === "cosmetic_badge"}
              className="px-3.5 py-2 rounded-lg border text-[13px] font-semibold text-textLight disabled:opacity-40"
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
