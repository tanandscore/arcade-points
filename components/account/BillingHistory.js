export default function BillingHistory({ payments }) {
  if (!payments.length) {
    return <p className="st-muted text-[14px]">No payments yet.</p>;
  }
  return (
    <div className="st-band overflow-hidden">
      <div className="divide-y divide-white/10">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-[15px] font-semibold text-textLight">{p.planName}</p>
              <p className="st-muted text-[13px]">
                {new Date(p.paid_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            <span className="font-mono text-[14px] font-semibold text-accentCyan">{p.price_label || "Paid"}</span>
          </div>
        ))}
      </div>
      <p className="px-4 py-3 st-muted text-[12.5px] border-t border-white/10">
        Prices shown are before any tax. Your emailed receipt from Fungies has the final total.
      </p>
    </div>
  );
}
