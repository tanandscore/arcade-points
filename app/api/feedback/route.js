import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { message } = await request.json();
  const trimmed = (message || "").trim();

  if (trimmed.length < 3 || trimmed.length > 2000) {
    return NextResponse.json({ error: "Feedback needs to be between 3 and 2000 characters." }, { status: 400 });
  }

  const { error } = await supabase.from("feedback").insert({ user_id: user.id, message: trimmed });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
