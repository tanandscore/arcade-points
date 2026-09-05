import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";

// Fills a real gap the admin panel deliberately doesn't cover:
// app/api/admin/users/[id]/route.js explicitly blocks an admin from
// deleting their own account through it ("You can't delete your own
// account from here.") — meaning before this route existed, there
// was no path at all for anyone, admin or not, to delete their own
// account.
//
// The id being deleted always comes from the caller's own verified
// session (user.id below), never from request input — a regular
// user can only ever delete themselves through this route, never
// anyone else, so using the service-role client here (required for
// auth.admin.deleteUser, the same call the admin route already
// makes) isn't a privilege escalation.
//
// Requires typing the exact username as confirmation — irreversible
// enough to deserve a real, deliberate confirmation step, not just a
// browser confirm() dialog a misclick could trigger.
export async function DELETE(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { confirmUsername } = await request.json();
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (!profile || confirmUsername !== profile.username) {
    return NextResponse.json({ error: "Username confirmation didn't match." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
