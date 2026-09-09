export default function PurchaseHistory({ purchases }) {
  if (!purchases.length) {
    return <p className="font-mono text-xs text-textDim">No one-time purchases yet.</p>;
  }

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
      {purchases.map((p) => (
        <div key={p.game} className="flex items-center justify-between px-4 py-3 border-b border-lineColor last:border-0">
          <span className="text-sm text-textLight">{p.gameName}</span>
          <span className="font-mono text-[10px] text-textDim">
            Purchased {new Date(p.purchased_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}
