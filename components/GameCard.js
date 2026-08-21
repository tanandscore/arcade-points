import Link from "next/link";

export default function GameCard({ href, icon, name, tagline, accentColor, best, price }) {
  return (
    <Link
      href={href}
      className="text-left rounded-xl border border-lineColor p-5 flex flex-col gap-3 bg-bgPanel hover:-translate-y-0.5 transition-transform"
    >
      <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl bg-bgPanel3">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: accentColor }}>
          {name}
          {price ? (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-accentAmber text-accentAmber">
              {price}
            </span>
          ) : (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-lineColor text-textDim">
              FREE
            </span>
          )}
        </h3>
        <p className="text-xs mt-1 text-textDim">{tagline}</p>
      </div>
      <div className="font-mono text-[11px] mt-1 text-textDim">
        Your best: <span className="text-textLight">{(best || 0).toLocaleString()}</span>
      </div>
      <span
        className="font-pixel text-[9px] mt-1 inline-block px-3 py-2 rounded-md text-center text-bgDeep"
        style={{ background: accentColor }}
      >
        PLAY ▸
      </span>
    </Link>
  );
}
