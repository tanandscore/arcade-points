function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  return `${mins}m ago`;
}

export default function LiveActivityPanel({ activity }) {
  return (
    <div>
      <div className="rounded-md border border-accentAmber/40 bg-accentAmber/10 p-3 mb-6">
        <p className="font-mono text-[10px] text-accentAmber">
          "Online" means played something in the last 10 minutes — there's no live connection tracking on this
          site, so this is a recent-activity proxy, not a real-time presence count. Location is the country each
          player picked at signup, not IP-based geolocation, which isn't collected here.
        </p>
      </div>

      <div className="rounded-xl border border-lineColor bg-bgPanel p-6 mb-6 text-center">
        <p className="font-pixel text-2xl text-accentCyan">{activity.onlineCount}</p>
        <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mt-1">Active in the last 10 minutes</p>
      </div>

      {activity.byCountry.length > 0 && (
        <div className="rounded-xl border border-lineColor bg-bgPanel p-5 mb-6">
          <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-3">By country</p>
          <div className="space-y-1.5">
            {activity.byCountry.map((c) => (
              <div key={c.country} className="flex items-center gap-3">
                <span className="font-mono text-xs text-textLight w-32 truncate">{c.country}</span>
                <div className="flex-1 h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
                  <div
                    className="h-full bg-accentCyan"
                    style={{ width: `${Math.round((c.count / activity.onlineCount) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-textDim w-8 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activity.recentUsers.length > 0 && (
        <div className="rounded-xl border border-lineColor bg-bgPanel p-5">
          <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mb-3">Recently active</p>
          <div className="space-y-1.5">
            {activity.recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-textLight">{u.username} <span className="text-textDim">· {u.country}</span></span>
                <span className="text-textDim">{u.game} · {timeAgo(u.playedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activity.onlineCount === 0 && (
        <p className="text-textDim text-sm text-center py-8">No activity in the last 10 minutes.</p>
      )}
    </div>
  );
}
