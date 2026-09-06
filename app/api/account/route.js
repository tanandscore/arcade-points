import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { COUNTRIES } from "@/lib/countries";

const VALID_CODES = new Set(COUNTRIES.map((c) => c.code));

export async function PATCH(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { username, country } = await request.json();

  if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 16) {
    return NextResponse.json({ error: "Username needs to be 3–16 characters." }, { status: 400 });
  }
  if (country && !VALID_CODES.has(country)) {
    return NextResponse.json({ error: "Invalid country." }, { status: 400 });
  }

  // Uses the service role so this can only ever touch username and
  // country — never is_admin or anything else, regardless of what a
  // modified client might try to send.
  const service = createServiceSupabase();
  const { error } = await service
    .from("profiles")
    .update({ username: username.trim(), country: country || null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
