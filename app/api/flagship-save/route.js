import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { FLAGSHIP_SYNC, MAX_SAVE_BYTES, MAX_KEY_BYTES, keyAllowed } from "@/lib/flagshipKeys";

// Account cloud save for the four flagship games (Upgrade 129). The browser keeps its own copy first and copies it here;
// every key carries a time stamp and the newer copy wins, key by key. Only whitelisted keys of plain text are stored.
const clean = (game, data) => {
  const out = {}; let total = 0;
  for (const [k, e] of Object.entries(data || {})) {
    if (!keyAllowed(game, k) || !e || typeof e.v !== "string" || e.v.length > MAX_KEY_BYTES) continue;
    total += e.v.length + k.length; if (total > MAX_SAVE_BYTES) break;
    out[k] = { v: e.v, t: Math.min(4e12, Math.max(0, Math.floor(+e.t || 0))) };
  }
  return out;
};

export async function GET(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const game = new URL(request.url).searchParams.get("game");
  if (!FLAGSHIP_SYNC[game]) return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  const { data, error } = await supabase.from("flagship_saves").select("data").eq("user_id", user.id).eq("game", game).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.data || {} });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_SAVE_BYTES + 20000) return NextResponse.json({ error: "Save is too large." }, { status: 413 });
  let body = {}; try { body = JSON.parse(raw); } catch {}
  const { game, data } = body || {};
  if (!FLAGSHIP_SYNC[game] || !data || typeof data !== "object") return NextResponse.json({ error: "Invalid." }, { status: 400 });
  // merge with what is stored, newer stamp wins per key, so two computers never wipe each other
  const { data: row } = await supabase.from("flagship_saves").select("data").eq("user_id", user.id).eq("game", game).maybeSingle();
  const merged = { ...(row?.data || {}) };
  for (const [k, e] of Object.entries(clean(game, data))) if (!merged[k] || (merged[k].t || 0) <= e.t) merged[k] = e;
  const { error } = await supabase.from("flagship_saves").upsert({ user_id: user.id, game, data: merged, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
