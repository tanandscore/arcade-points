import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { hasSubscriptionAccess } from "@/lib/access";
import { isAdmin } from "@/lib/admin";

const STARTER_CHARACTER = {
  level: 1,
  xp: 0,
  hp: 30,
  max_hp: 30,
  stamina: 20,
  max_stamina: 20,
  base_attack: 5,
  base_defense: 2,
  gold: 20,
  equipped_weapon: null,
  equipped_armor: null,
  inventory: [],
  quests: [],
};

async function checkAccess(supabase, userId) {
  const admin = await isAdmin(supabase, userId);
  if (admin) return true;
  return hasSubscriptionAccess(supabase, userId, "premium_plus");
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  if (!(await checkAccess(supabase, user.id))) {
    return NextResponse.json({ error: "Legend Pass required." }, { status: 403 });
  }

  const { data } = await supabase.from("rpg_characters").select("*").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ character: data });
}

// Creates a brand-new character — only used the first time someone
// plays, before any character exists for their account.
export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  if (!(await checkAccess(supabase, user.id))) {
    return NextResponse.json({ error: "Legend Pass required." }, { status: 403 });
  }

  const { name } = await request.json();
  const trimmed = (name || "").trim().slice(0, 24);
  if (!trimmed) {
    return NextResponse.json({ error: "Enter a name for your character." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rpg_characters")
    .insert({ user_id: user.id, name: trimmed, ...STARTER_CHARACTER })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ character: data });
}

// Saves progress — called after combat, quest completion, equipment
// changes, and leveling up. The client sends the whole current
// character state; this route trusts it because it's already scoped
// by RLS to the logged-in user's own row, and the numbers here are
// gameplay progress, not anything with real-world value (unlike gold
// or purchases elsewhere on the site, which go through validated
// server logic instead of a client-trusted write).
export async function PUT(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  if (!(await checkAccess(supabase, user.id))) {
    return NextResponse.json({ error: "Legend Pass required." }, { status: 403 });
  }

  const updates = await request.json();
  delete updates.user_id; // never let the client move who owns this row

  const { data, error } = await supabase
    .from("rpg_characters")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ character: data });
}
