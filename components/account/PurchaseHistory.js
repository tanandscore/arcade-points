export default function PurchaseHistory({ purchases }) {
  if (!purchases.length) {
    return <p className="st-muted text-[14px]">No one-time purchases yet.</p>;
  }

  return (
    <div className="st-band overflow-hidden divide-y divide-white/10">
      {purchases.map((p) => (
        <div key={p.game} className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[15px] font-semibold text-textLight">{p.gameName}</span>
          <span className="st-muted text-[13px]">
            Purchased {new Date(p.purchased_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}
