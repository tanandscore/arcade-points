export default function DailyChallengesPanel({ challenges }) {
  if (!challenges || challenges.length === 0) return null;
  const completedCount = challenges.filter((c) => c.completed).length;

  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel p-5 sm:p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-[11px] tracking-wide text-accentCyan">TODAY'S CHALLENGES</h2>
        <p className="font-mono text-[11px] text-textDim">{completedCount}/{challenges.length} done</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {challenges.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border p-3"
            style={{ borderColor: c.completed ? "#6bff6b" : "rgba(169,159,214,0.25)", opacity: c.completed ? 1 : 0.8 }}
          >
            <p className="font-mono text-xs text-textLight flex items-center gap-1.5">
              {c.completed ? "✅" : "⬜"} {c.name}
            </p>
            <p className="font-mono text-[10px] text-textDim mt-1">{c.description}</p>
            <p className="font-mono text-[9px] text-accentAmber mt-1.5">+{c.xpReward} XP</p>
          </div>
        ))}
      </div>
    </div>
  );
}
