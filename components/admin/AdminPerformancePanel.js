function formatValue(value, unit) {
  if (value == null) return "—";
  if (unit === "ms") return `${Math.round(value).toLocaleString()}ms`;
  if (unit === "") return value < 10 ? value.toFixed(3) : Math.round(value).toLocaleString();
  return value.toLocaleString();
}

export default function AdminPerformancePanel({ metrics }) {
  const withData = metrics.filter((m) => m.totalSamples > 0);

  return (
    <div>
      <p className="font-mono text-[10px] text-textDim mb-4">
        Real, browser-measured values from the last 24 hours — nothing here is estimated or synthetic.
        {withData.length === 0 && " No data collected yet; this fills in as real visitors load pages."}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.id} className="rounded-lg border border-lineColor bg-bgPanel p-4">
            <p className="font-mono text-[10px] text-textDim uppercase tracking-wide">{m.name}</p>
            <p className="font-pixel text-lg text-textLight mt-1">{formatValue(m.overallAvg, m.unit)}</p>
            <p className="font-mono text-[9px] text-textDim mt-1">{m.totalSamples.toLocaleString()} samples</p>
            {m.byPath.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {m.byPath.map((p) => (
                  <div key={p.path} className="flex justify-between font-mono text-[9px] text-textDim">
                    <span className="truncate max-w-[60%]">{p.path}</span>
                    <span>{formatValue(p.avgValue, m.unit)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
