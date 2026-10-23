// Checks whether a user is an admin. Admins bypass every paywall
// (one-time and subscription) and can access /admin to manage users.
// There's no in-app way to grant admin — the first one is always set
// directly in Supabase's Table Editor (profiles.is_admin), which is
// intentional: a privilege this powerful shouldn't be grantable purely
// through the app's own UI.
export async function isAdmin(supabase, userId) {
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return !!data?.is_admin;
}
