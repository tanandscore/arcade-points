// Real "what's new" surfacing — previously a returning player had no
// way to discover any of the work that's gone into the games since
// their last visit (new enemy types, teammate identity, trade depth,
// multiple maps, and more). This is the read/write logic; the admin
// authoring UI, public page, and navbar badge are separate pieces
// built on top of it.

// Selects published too — regular page-visitor calls (via the
// user's own session) only ever get published=true rows back
// anyway, since RLS enforces that at the database level as of
// migration_063. The admin panel (using the service-role client,
// which bypasses RLS) needs this field to actually show and toggle
// each entry's current state.
export async function getChangelogEntries(supabase, limit = 30) {
  const { data } = await supabase
    .from("changelog_entries")
    .select("id, title, body, game_slug, published, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// Unread count is "entries published after this user's last visit to
// /changelog" — computed from a single timestamp rather than
// per-entry read receipts, since a badge count is all the UI
// actually needs. A user who has never visited gets every entry
// counted (last_read_at defaults to year 2000 in the migration), not
// zero — someone who's never seen the changelog has everything in it
// unread, not nothing.
export async function getUnreadChangelogCount(supabase, userId) {
  if (!userId) return 0;
  const { data: readRow } = await supabase.from("user_changelog_reads").select("last_read_at").eq("user_id", userId).maybeSingle();
  const since = readRow?.last_read_at || "2000-01-01";
  const { count } = await supabase
    .from("changelog_entries")
    .select("id", { count: "exact", head: true })
    .gt("published_at", since);
  return count || 0;
}

export async function markChangelogRead(supabase, userId) {
  await supabase.from("user_changelog_reads").upsert({ user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "user_id" });
}
