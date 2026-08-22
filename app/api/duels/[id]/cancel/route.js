import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("duels")
    .delete()
    .eq("id", id)
    .eq("player1_id", user.id) // only the searcher themselves can cancel
    .eq("status", "waiting"); // and only before anyone's joined

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
