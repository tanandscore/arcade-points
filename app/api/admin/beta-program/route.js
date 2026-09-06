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
  const { data, error } = await service.from("beta_program").select("*").eq("id", 1).single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ program: data });
}

export async function PATCH(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const updates = {};

  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.max_slots === "number" && body.max_slots > 0 && body.max_slots <= 100000) updates.max_slots = Math.round(body.max_slots);
  if (typeof body.duration_days === "number" && body.duration_days > 0 && body.duration_days <= 3650) updates.duration_days = Math.round(body.duration_days);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service.from("beta_program").update(updates).eq("id", 1).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ program: data });
}
