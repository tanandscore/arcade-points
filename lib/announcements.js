import { createServerSupabase } from "./supabaseServer";

// The newest announcement that is switched on and inside its schedule window, or null.
export async function getActiveAnnouncement() {
  try {
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const { data } = await supabase.from("site_announcements").select("id, message, level, link_url, link_label, starts_at, ends_at").eq("is_active", true).lte("starts_at", now).order("created_at", { ascending: false }).limit(5);
    return (data || []).find((a) => !a.ends_at || a.ends_at > now) || null;
  } catch { return null; }
}
