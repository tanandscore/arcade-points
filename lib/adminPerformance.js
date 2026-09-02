import { createServiceSupabase } from "@/lib/supabaseServer";

const METRIC_LABELS = {
  lcp: { name: "Largest Contentful Paint", unit: "ms" },
  cls: { name: "Cumulative Layout Shift", unit: "" },
  ttfb: { name: "Time to First Byte", unit: "ms" },
  fid: { name: "First Input Delay", unit: "ms" },
  load_time: { name: "Page Load Time", unit: "ms" },
  game_launch: { name: "Game Launch Time (cold)", unit: "ms" },
  resource_count: { name: "Network Requests", unit: "" },
};

// Reads through the game_player_counts-style aggregation function
// (performance_summary — see migration_048), never the raw table.
// Applies the exact lesson from migration_047: aggregate in
// Postgres, don't fetch rows and average them in JavaScript.
export async function getPerformanceSummary(sinceHours = 24) {
  const service = createServiceSupabase();
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data } = await service.rpc("performance_summary", { since });

  const byMetric = {};
  for (const row of data || []) {
    if (!byMetric[row.metric]) byMetric[row.metric] = [];
    byMetric[row.metric].push({ path: row.path, avgValue: Number(row.avg_value), sampleCount: Number(row.sample_count) });
  }

  return Object.entries(METRIC_LABELS).map(([id, meta]) => {
    const rows = (byMetric[id] || []).sort((a, b) => b.sampleCount - a.sampleCount);
    const totalSamples = rows.reduce((sum, r) => sum + r.sampleCount, 0);
    const overallAvg = totalSamples > 0 ? rows.reduce((sum, r) => sum + r.avgValue * r.sampleCount, 0) / totalSamples : null;
    return { id, name: meta.name, unit: meta.unit, overallAvg, totalSamples, byPath: rows.slice(0, 6) };
  });
}
