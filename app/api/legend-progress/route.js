import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { LEGEND_SLUGS } from "@/lib/legend";

export async function GET(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const game = new URL(request.url).searchParams.get("game");
  if (!LEGEND_SLUGS.includes(game)) return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  const { data, error } = await supabase.from("legend_progress").select("data").eq("user_id", user.id).eq("game", game).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.data || null });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { game, data } = await request.json().catch(() => ({}));
  if (!LEGEND_SLUGS.includes(game) || !data || typeof data !== "object") return NextResponse.json({ error: "Invalid." }, { status: 400 });
  // Only these plain numbers/flags are kept, so nothing else can be stored through this route.
  const clean = {
    runs: +data.runs || 0, total: +data.total || 0, best: +data.best || 0, points: +data.points || 0, streak: +data.streak || 0,
    lastDay: String(data.lastDay || "").slice(0, 10), missionDay: String(data.missionDay || "").slice(0, 10),
    missionDone: !!data.missionDone, missionRuns: +data.missionRuns || 0,
    challengeBest: Object.fromEntries(["standard", "veteran", "nightmare"].map((k) => [k, +(data.challengeBest || {})[k] || 0])),
  };
  const { error } = await supabase.from("legend_progress").upsert({ user_id: user.id, game, data: clean, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
