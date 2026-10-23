import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

// "Download my data" — gives a signed-in person a copy of everything we hold about them, as one JSON file
// (the right of access / portability under GDPR, UK GDPR, India's DPDP Act, Brazil's LGPD, California's CCPA and similar laws).
// The id always comes from the caller's own verified session, never from the request, so nobody can fetch anyone else's data.
// The service client is used only so every table can be read the same way; every query is pinned to this one user's id.
const TABLES = [
  ["profiles", "id"],
  ["scores", "user_id"],
  ["difficulty_scores", "user_id"],
  ["purchases", "user_id"],
  ["subscriptions", "user_id"],
  ["payment_history", "user_id"],
  ["user_achievements", "user_id"],
  ["activity_days", "user_id"],
  ["activity_events", "user_id"],
  ["last_played", "user_id"],
  ["daily_challenge_completions", "user_id"],
  ["user_season_xp", "user_id"],
  ["tournament_scores", "user_id"],
  ["legend_progress", "user_id"],
  ["rpg_characters", "user_id"],
  ["feedback", "user_id"],
  ["user_changelog_reads", "user_id"],
  ["duels", "player1_id"],
  ["duels", "player2_id"],
];

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const service = createServiceSupabase();
  const out = {
    exported_at: new Date().toISOString(),
    note: "A copy of the personal data Tap & Score holds about your account. Payment card details are held only by our payment provider, Fungies.",
    account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, signup_details: user.user_metadata || {} },
    data: {},
    not_included: ["A one-way scrambled (hashed) network-address fingerprint used only to stop duplicate beta sign-ups — it cannot be turned back into an address."],
  };
  for (const [table, col] of TABLES) {
    const key = col === "id" || col === "user_id" ? table : `${table}_as_${col === "player1_id" ? "player1" : "player2"}`;
    try {
      const { data, error } = await service.from(table).select("*").eq(col, user.id).limit(20000);
      if (error) { out.data[key] = { unavailable: true }; continue; }
      out.data[key] = data;
    } catch { out.data[key] = { unavailable: true }; }
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tap-and-score-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
