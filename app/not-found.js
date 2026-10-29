import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="bg-bgDeep text-textLight">
      <MarqueeBar rightSlot={<Link href="/games" className="st-btn st-btn-ghost st-btn-sm">Browse games</Link>} />
      <div className="st-container flex min-h-[62vh] flex-col items-center justify-center py-16 text-center">
        <p className="st-h1" style={{ fontSize: "clamp(4.5rem, 14vw, 8rem)", color: "#3ee6e0", lineHeight: 1 }} aria-hidden="true">404</p>
        <h1 className="st-h2 mt-4" style={{ fontSize: "1.7rem" }}>This page doesn&apos;t exist</h1>
        <p className="st-muted mt-3 max-w-md text-[16px] leading-relaxed">
          The link may be wrong, or the page may have moved. Press <kbd className="rounded border border-white/25 px-1.5 py-0.5 text-[13px]">/</kbd> to search for a game.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/games" className="st-btn st-btn-primary">Browse games</Link>
          <Link href="/" className="st-btn st-btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
