export default function AdminFeedbackPanel({ entries }) {
  if (!entries.length) {
    return <p className="font-mono text-xs text-textDim">No feedback yet.</p>;
  }

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
      {entries.map((e) => (
        <div key={e.id} className="px-4 py-3 border-b border-lineColor last:border-0">
          <div className="flex justify-between font-mono text-[10px] text-textDim mb-1.5">
            <span>{e.profiles?.username || "player"}</span>
            <span>{new Date(e.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-textLight whitespace-pre-wrap">{e.message}</p>
        </div>
      ))}
    </div>
  );
}
