import Link from "next/link";

// The slim header used on the sign-in pages and the legal / info pages (pages that are not part of the store itself).
// Upgrade 70: the blinking marquee lights are gone; it is now the same bar as the store's top bar, so moving between the
// store and these pages does not change the look of the site. `rightSlot` is whatever buttons a page wants on the right.
export default function MarqueeBar({ rightSlot }) {
  return (
    <header className="st-top">
      <div className="st-container flex items-center justify-between gap-3 h-14">
        <Link href="/" className="st-logo" aria-label="Tap and Score home">TAP<b>&amp;</b>SCORE</Link>
        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>
    </header>
  );
}
