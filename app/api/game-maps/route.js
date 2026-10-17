import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Public: which maps of a game are switched off.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("game");
  if (!slug) return NextResponse.json({ disabled: [] });
  try {
    const service = createServiceSupabase();
    const { data } = await service.from("game_maps").select("map_id").eq("game_slug", slug).eq("enabled", false);
    return NextResponse.json({ disabled: (data || []).map((r) => r.map_id) });
  } catch {
    return NextResponse.json({ disabled: [] });
  }
}
