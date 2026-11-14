import { NextResponse } from "next/server";
import { requireAdmin, audit } from "@/lib/adminGuard";

export async function PATCH(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { id, status, admin_note } = await request.json();
  const updates = {};
  if (["new", "reviewed", "resolved"].includes(status)) updates.status = status;
  if (typeof admin_note === "string") updates.admin_note = admin_note.slice(0, 500);
  if (!id || !Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { error } = await c.service.from("feedback").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, "feedback.update", id, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const { id } = await request.json();
  const { error } = await c.service.from("feedback").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(c, "feedback.delete", id);
  return NextResponse.json({ success: true });
}
