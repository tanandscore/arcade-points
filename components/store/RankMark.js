// The rank number on a leaderboard row: gold, silver and bronze discs for the top three, a plain number for everyone else.
const MEDAL = { 1: ["#ffd25a", "#3a2600"], 2: ["#d9deea", "#1e2433"], 3: ["#e39a62", "#331703"] };

export default function RankMark({ rank }) {
  const m = MEDAL[rank];
  if (m) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums" style={{ background: m[0], color: m[1] }} aria-label={`Rank ${rank}`}>
        {rank}
      </span>
    );
  }
  return <span className="inline-block w-7 shrink-0 text-center text-[14px] tabular-nums text-[#a99fd6]" aria-label={`Rank ${rank}`}>{rank}</span>;
}
