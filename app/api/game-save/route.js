import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isKitSlug } from "@/lib/catalog";

// Cloud save for the 2D games (Upgrade 70). Each player has at most one row per game (table game_saves, migration 088).
// The browser keeps its own copy first (so guests and offline play work) and copies it here; when both exist the games merge
// them by "keep the best". This route only stores plain numbers and short text, so nothing else can be pushed through it.

const MAX_BODY = 60000; // bytes of JSON accepted in one save
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+v || 0)));

// Copies simple JSON (numbers, short text, true/false, small lists and objects) and drops everything else.
function plain(v, depth = 0) {
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return v.slice(0, 120);
  if (depth >= 4) return null;
  if (Array.isArray(v)) return v.slice(0, 300).map((x) => plain(x, depth + 1));
  if (typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).slice(0, 120)) if (/^[\w.\-]{1,32}$/.test(k)) out[k] = plain(v[k], depth + 1);
    return out;
  }
  return null;
}

function cleanSave(d) {
  const levels = {};
  let n = 0;
  for (const [k, v] of Object.entries(d.levels || {})) {
    if (n++ >= 400) break;
    if (!/^[\w.\-]{1,24}$/.test(k) || !v || typeof v !== "object") continue;
    levels[k] = { stars: int(v.stars, 0, 3), best: int(v.best, 0, 1e10), time: Math.min(86400, Math.max(0, +v.time || 0)) };
  }
  const s = d.stats || {};
  return {
    v: 1,
    levels,
    stats: { plays: int(s.plays, 0, 1e9), wins: int(s.wins, 0, 1e9), deaths: int(s.deaths, 0, 1e9), score: int(s.score, 0, 1e12) },
    settings: plain(d.settings && typeof d.settings === "object" ? d.settings : {}, 3),
    extra: plain(d.extra && typeof d.extra === "object" ? d.extra : {}, 1),
    t: int(d.t, 0, 4e12),
  };
}

export async function GET(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const game = new URL(request.url).searchParams.get("game");
  if (!isKitSlug(game)) return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  const { data, error } = await supabase.from("game_saves").select("data").eq("user_id", user.id).eq("game", game).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.data || null });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Save is too large." }, { status: 413 });
  let body = {};
  try { body = JSON.parse(raw); } catch {}
  const { game, data } = body || {};
  if (!isKitSlug(game) || !data || typeof data !== "object") return NextResponse.json({ error: "Invalid." }, { status: 400 });
  const clean = cleanSave(data);
  const { error } = await supabase.from("game_saves").upsert({ user_id: user.id, game, data: clean, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
