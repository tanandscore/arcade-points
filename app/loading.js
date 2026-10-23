export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 rounded bg-white/10 animate-pulse mb-3" />
      <div className="h-4 w-72 rounded bg-white/5 animate-pulse mb-8" />
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />)}
      </div>
    </div>
  );
}
