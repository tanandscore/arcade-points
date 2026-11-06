export default function Loading() {
  return (
    <div className="st-container py-8" aria-busy="true" aria-label="Loading">
      <div className="flex gap-2 mb-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 rounded-full bg-white/[0.06] animate-pulse" style={{ width: 80 + (i % 3) * 24 }} />)}
      </div>
      <div className="h-[300px] sm:h-[420px] rounded-[20px] bg-white/[0.05] animate-pulse" />
      <div className="h-6 w-44 rounded bg-white/10 animate-pulse mt-12 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-video rounded-xl bg-white/[0.05] animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse mt-3" />
            <div className="h-3 w-1/3 rounded bg-white/5 animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
