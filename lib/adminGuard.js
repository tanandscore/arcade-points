import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";

// One place for "is this request from an admin?" so every admin route checks it the same way.
export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  return { ok: true, adminId: user.id, adminName: p?.username || user.email, service: createServiceSupabase() };
}

// Writes one line to the audit log. Never lets a logging problem break the action itself.
export async function audit(check, action, target, details) {
  try { await check.service.from("admin_audit_log").insert({ admin_id: check.adminId, admin_name: check.adminName, action, target: target == null ? null : String(target), details: details || null }); } catch {}
}
