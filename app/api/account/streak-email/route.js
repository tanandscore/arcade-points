import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// A real, working opt-out for streak-reminder emails — available to
// every logged-in user, not gated behind a subscription like the
// perks route this file's pattern is based on, since this is about
// consent to receive email, not a paid benefit.
export async function PATCH(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json();
  if (typeof body.opt_out !== "boolean") {
    return NextResponse.json({ error: "opt_out must be true or false." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ streak_email_opt_out: body.opt_out }).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not update preference." }, { status: 500 });
  }
  return NextResponse.json({ streak_email_opt_out: body.opt_out });
}
