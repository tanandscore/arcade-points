import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Deliberately public, no auth check — the maintenance page itself
// polls this to know when to redirect people back to what they were
// doing, and by definition a person stuck on that page has no
// session context worth gating this behind.
export async function GET() {
  const service = createServiceSupabase();
  const { data } = await service.from("site_settings").select("maintenance_mode").eq("id", 1).maybeSingle();
  return NextResponse.json({ maintenanceMode: data?.maintenance_mode ?? false });
}
