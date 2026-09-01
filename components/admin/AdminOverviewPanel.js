function paiseToRupees(paise) {
  return `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AdminOverviewPanel({ overview }) {
  const o = overview;
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Total Users" value={o.totalUsers.toLocaleString()} />
        <Stat label="Active Today" value={o.activeUsersToday.toLocaleString()} />
        <Stat label="Weekly Active" value={o.wau.toLocaleString()} />
        <Stat label="Monthly Active" value={o.mau.toLocaleString()} />
        <Stat label="Active Subscribers" value={o.activeSubscribers.toLocaleString()} />
        <Stat label="Games in Catalog" value={o.totalGamesInCatalog.toLocaleString()} />
        <Stat label="Distinct Games Played Today" value={o.distinctGamesPlayedToday.toLocaleString()} />
        <Stat label="DAU (exact)" value={o.dau.toLocaleString()} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg border border-accentAmber/40 bg-bgPanel p-4">
          <p className="font-mono text-[10px] text-textDim uppercase tracking-wide">MRR (estimated)</p>
          <p className="font-pixel text-lg text-accentAmber mt-1">{paiseToRupees(o.mrrPaise)}</p>
          <p className="font-mono text-[9px] text-textDim mt-2">
            Sum of active subscriptions × list price. Assumes list price paid — doesn't account for discounts,
            coupons, or refunds, since none of those are tracked in the database.
          </p>
        </div>
        <div className="rounded-lg border border-accentAmber/40 bg-bgPanel p-4">
          <p className="font-mono text-[10px] text-textDim uppercase tracking-wide">One-time purchase revenue (estimated, all-time)</p>
          <p className="font-pixel text-lg text-accentAmber mt-1">{paiseToRupees(o.purchaseRevenuePaiseAllTime)}</p>
          <p className="font-mono text-[9px] text-textDim mt-2">Sum of one-time game purchases × list price, same caveat as above.</p>
        </div>
      </div>

      <div className="rounded-lg border border-lineColor bg-bgPanel p-4">
        <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-3">Most-played games (all-time, by distinct players)</p>
        <div className="space-y-1.5">
          {o.topGames.map((g, i) => (
            <div key={g.slug} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-textLight">{i + 1}. {g.icon} {g.name}</span>
              <span className="text-textDim">{g.players.toLocaleString()} players</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-lineColor bg-bgPanel p-3 text-center">
      <p className="font-pixel text-sm text-textLight">{value}</p>
      <p className="font-mono text-[9px] text-textDim mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}
