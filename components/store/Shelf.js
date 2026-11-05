import Link from "next/link";
import { ArrowRight } from "./Icons";

// A titled row of games. `cols` decides how many cards sit side by side on a wide screen.
export default function Shelf({ id, title, note, href, hrefLabel = "See all", cols = 4, children, className = "" }) {
  const grid = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  }[cols] || "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="st-h2">{title}</h2>
          {note && <p className="st-muted text-sm mt-1 max-w-[60ch]">{note}</p>}
        </div>
        {href && (
          <Link href={href} className="st-link text-sm shrink-0 inline-flex items-center gap-1.5">
            {hrefLabel} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className={`grid ${grid} gap-x-4 gap-y-6 sm:gap-x-5`}>{children}</div>
    </section>
  );
}
