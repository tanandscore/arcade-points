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
  const { data, error } = await service.from("site_settings").select("*").eq("id", 1).single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
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
  if (typeof body.maintenance_mode === "boolean") updates.maintenance_mode = body.maintenance_mode;
  if (typeof body.maintenance_message === "string" && body.maintenance_message.trim()) {
    updates.maintenance_message = body.maintenance_message.trim().slice(0, 500);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service.from("site_settings").update(updates).eq("id", 1).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
