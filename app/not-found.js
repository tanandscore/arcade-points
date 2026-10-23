import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 text-textLight">
      <p className="font-pixel text-4xl text-accentCyan mb-4">404</p>
      <h1 className="font-display font-bold text-2xl mb-2">This level doesn&apos;t exist</h1>
      <p className="text-textDim text-sm mb-6 max-w-sm">The page you wanted is gone or the link is wrong. Press <kbd className="px-1.5 py-0.5 rounded border border-lineColor">/</kbd> to search for a game.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/dashboard" className="font-mono text-[11px] px-5 py-2.5 rounded-md bg-accentCyan text-bgDeep">Browse games</Link>
        <Link href="/" className="font-mono text-[11px] px-5 py-2.5 rounded-md border border-lineColor text-textDim">Home</Link>
      </div>
    </div>
  );
}
