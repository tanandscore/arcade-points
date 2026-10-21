import { redirect } from "next/navigation";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/admin";

// Shared gate for admin pages: sends visitors away unless they are an admin, and hands back what every page needs.
export async function getAdminContext() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  return { supabase, user, username: profile?.username || user.email, service: createServiceSupabase() };
}
