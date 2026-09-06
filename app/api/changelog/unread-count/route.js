import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getUnreadChangelogCount } from "@/lib/changelog";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ count: 0 });
  }
  const count = await getUnreadChangelogCount(supabase, user.id);
  return NextResponse.json({ count });
}
