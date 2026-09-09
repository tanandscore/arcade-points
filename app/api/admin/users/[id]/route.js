import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { ok: true, adminId: user.id };
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  if (id === check.adminId) {
    return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { password } = await request.json();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service.auth.admin.updateUserById(id, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
