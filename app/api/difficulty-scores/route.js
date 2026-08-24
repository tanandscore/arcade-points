import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGame } from "@/lib/games";
import { isAdmin } from "@/lib/admin";
import { hasSubscriptionAccess } from "@/lib/access";

async function checkAccess(supabase, user, gameDef) {
  const admin = await isAdmin(supabase, user.id);
  if (admin) return true;
  if (gameDef.accessType !== "subscription") return true;
  const { data: profile } = await supabase.from("profiles").select("bonus_subscription_until").eq("id", user.id).maybeSingle();
  return hasSubscriptionAccess(supabase, user.id, gameDef.subscriptionPlanId, profile);
}

// Returns the current user's best score at every difficulty they've
// played, for one game — used to show "your best: 340" next to each
// tier on the difficulty-select screen.
export async function GET(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const game = new URL(request.url).searchParams.get("game");
  if (!game) return NextResponse.json({ error: "Missing game." }, { status: 400 });

  const { data, error } = await supabase
    .from("difficulty_scores")
    .select("difficulty, score")
    .eq("user_id", user.id)
    .eq("game", game);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byDifficulty = {};
  for (const row of data || []) byDifficulty[row.difficulty] = row.score;
  return NextResponse.json({ bests: byDifficulty });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { game, difficulty, score } = await request.json();
  const gameDef = await getGame(game);
  if (!gameDef || !difficulty || typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  if (!(await checkAccess(supabase, user, gameDef))) {
    return NextResponse.json({ error: "This game needs an active subscription to this tier." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("difficulty_scores")
    .select("score")
    .eq("user_id", user.id)
    .eq("game", game)
    .eq("difficulty", difficulty)
    .maybeSingle();

  const prevBest = existing?.score || 0;
  const isNewBest = score > prevBest;

  if (isNewBest) {
    const { error } = await supabase
      .from("difficulty_scores")
      .upsert({ user_id: user.id, game, difficulty, score, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ isNewBest, best: Math.max(prevBest, score) });
}
