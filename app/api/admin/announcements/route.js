import { NextResponse } from "next/server";
import { requireAdmin, audit } from "@/lib/adminGuard";

export async function GET() {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { data, error } = await c.service.from("site_announcements").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [] });
}

export async function POST(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const b = await request.json();
  const message = String(b.message || "").trim().slice(0, 300);
  if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const row = { message, level: ["info", "promo", "warning"].includes(b.level) ? b.level : "info", link_url: b.link_url ? String(b.link_url).slice(0, 300) : null, link_label: b.link_label ? String(b.link_label).slice(0, 40) : null, is_active: true };
  if (row.link_url && !/^(\/|https:\/\/)/.test(row.link_url)) return NextResponse.json({ error: "The link must start with / or https://" }, { status: 400 });
  if (b.starts_at && !isNaN(new Date(b.starts_at))) row.starts_at = new Date(b.starts_at).toISOString();
  if (b.ends_at && !isNaN(new Date(b.ends_at))) row.ends_at = new Date(b.ends_at).toISOString();
  const { data, error } = await c.service.from("site_announcements").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, "announcement.create", data.id, { message, level: row.level });
  return NextResponse.json({ announcement: data });
}

export async function PATCH(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { id, is_active } = await request.json();
  if (!id || typeof is_active !== "boolean") return NextResponse.json({ error: "Missing id or state." }, { status: 400 });
  const { data, error } = await c.service.from("site_announcements").update({ is_active }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, is_active ? "announcement.show" : "announcement.hide", id);
  return NextResponse.json({ announcement: data });
}

export async function DELETE(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { id } = await request.json();
  const { error } = await c.service.from("site_announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, "announcement.delete", id);
  return NextResponse.json({ success: true });
}
