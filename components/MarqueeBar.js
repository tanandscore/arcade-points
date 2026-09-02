import Link from "next/link";

const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

export default function MarqueeBar({ rightSlot }) {
  return (
    <div className="relative px-4 py-3 sm:px-6 sm:py-4 border-b border-lineColor bg-bgPanel">
      <div className="flex justify-center gap-2 mb-2">
        {new Array(18).fill(0).map((_, i) => {
          const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
          return (
            <span
              key={i}
              className="ap-marquee-light inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color, color, animationDelay: `${(i % 6) * 0.12}s` }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-pixel text-sm text-textLight">
          TAP & SCORE
        </Link>
        {rightSlot}
      </div>
    </div>
  );
}
