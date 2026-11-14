import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const service = createServiceSupabase();
  const [{ data: authData, error: authError }, { data: profiles }, { data: subscriptions }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 200 }),
    service.from("profiles").select("id, username, is_admin, is_premium, bonus_subscription_until"),
    service.from("subscriptions").select("user_id, plan_id, status, cancel_at_period_end, current_period_end"),
  ]);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const profileById = {};
  for (const p of profiles || []) profileById[p.id] = p;

  const subsByUser = {};
  for (const s of subscriptions || []) {
    if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
    subsByUser[s.user_id].push({ planId: s.plan_id, status: s.status, cancelAtPeriodEnd: s.cancel_at_period_end, currentPeriodEnd: s.current_period_end });
  }

  const now = new Date();
  const users = (authData?.users || [])
    .map((u) => {
      const profile = profileById[u.id];
      const bonusActive = profile?.bonus_subscription_until && new Date(profile.bonus_subscription_until) > now;
      return {
        id: u.id,
        email: u.email,
        username: profile?.username || null,
        isAdmin: profile?.is_admin || false,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        subscriptions: subsByUser[u.id] || [],
        bonusUntil: bonusActive ? profile.bonus_subscription_until : null,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return NextResponse.json({ users });
}

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { email, password, username } = await request.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "Email and a password (6+ characters) are required." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin-created accounts don't need email verification
    user_metadata: { username: (username || "").trim() || undefined },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: data.user.id });
}
