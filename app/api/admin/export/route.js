import { NextResponse } from "next/server";
import { requireAdmin, audit } from "@/lib/adminGuard";

const esc = (v) => { if (v == null) return ""; let s = typeof v === "object" ? JSON.stringify(v) : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; // leading ' stops spreadsheets running a cell as a formula
const TABLES = {
  players: ["profiles", "username, country, created_at, lifetime_points, platform_xp, is_premium, is_suspended", "created_at"],
  scores: ["scores", "user_id, game, score, updated_at", "updated_at"],
  feedback: ["feedback", "id, message, status, admin_note, created_at", "created_at"],
  audit: ["admin_audit_log", "id, admin_name, action, target, details, created_at", "created_at"],
};

// Downloads a table as a CSV file. Emails and passwords are never included.
export async function GET(request) {
  const c = await requireAdmin(); if (!c.ok) return c.response;
  const type = new URL(request.url).searchParams.get("type");
  const t = TABLES[type]; if (!t) return NextResponse.json({ error: "Unknown export." }, { status: 400 });
  const cols = t[1].split(",").map((x) => x.trim());
  const { data, error } = await c.service.from(t[0]).select(t[1]).order(t[2], { ascending: false }).limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const csv = [cols.join(","), ...(data || []).map((r) => cols.map((k) => esc(r[k])).join(","))].join("\n");
  await audit(c, "export." + type, null, { rows: (data || []).length });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tapandscore-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
