import Link from "next/link";

const FLAGSHIP_SLUGS = ["operationblacksite", "kingdomsofash", "wrathofolympus"];

// Deliberately its own component rather than another GameCard prop
// variant — flagship games need to look genuinely different (bigger,
// a real badge, its own section) from an ordinary rail entry, not
// just "GameCard but slightly bigger."
export default function FlagshipBanner({ games, bestByGame }) {
  const flagshipGames = FLAGSHIP_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(Boolean);
  if (flagshipGames.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-pixel text-[11px] tracking-widest text-accentAmber mb-3">★ FLAGSHIP GAMES</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {flagshipGames.map((game) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="relative rounded-xl border-2 p-6 flex flex-col gap-3 bg-bgPanel hover:-translate-y-0.5 transition-transform overflow-hidden"
            style={{ borderColor: game.accentColor }}
          >
            <span
              className="absolute top-3 right-3 font-mono text-[9px] px-2 py-1 rounded-full"
              style={{ background: game.accentColor, color: "#0a0616" }}
            >
              ★ FLAGSHIP
            </span>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-bgPanel3">
              {game.icon}
            </div>
            <div>
              <h3 className="font-pixel text-sm mb-1" style={{ color: game.accentColor }}>
                {game.name}
              </h3>
              <p className="text-sm text-textDim">{game.tagline}</p>
            </div>
            <div className="font-mono text-[11px] mt-1 text-textDim">
              Your best: <span className="text-textLight">{(bestByGame[game.slug] || 0).toLocaleString()}</span>
            </div>
            <span
              className="font-pixel text-[9px] mt-1 inline-block px-4 py-2.5 rounded-md text-center text-bgDeep w-fit"
              style={{ background: game.accentColor }}
            >
              PLAY ▸
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
