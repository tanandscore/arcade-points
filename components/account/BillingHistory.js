export default function BillingHistory({ payments }) {
  if (!payments.length) {
    return <p className="font-mono text-xs text-textDim">No payments yet.</p>;
  }
  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-lineColor last:border-0">
          <div>
            <p className="text-sm text-textLight">{p.planName}</p>
            <p className="font-mono text-[10px] text-textDim">
              {new Date(p.paid_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
          <span className="font-mono text-xs text-accentCyan">{p.price_label || "Paid"}</span>
        </div>
      ))}
      <p className="px-4 py-2 font-mono text-[10px] text-textDim border-t border-lineColor">
        Prices shown are before any tax. Your emailed receipt from Fungies has the final total.
      </p>
    </div>
  );
}
