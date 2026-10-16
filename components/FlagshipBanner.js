import Link from "next/link";

// The first slug is THE flagship of the site: it gets a full-width hero
// card with its own pitch line. The rest sit beneath it as ordinary
// featured cards.
const FLAGSHIP_SLUGS = ["midnightburn", "operationblacksite", "kingdomsofash", "wrathofolympus"];
const HERO_PITCH = {
  midnightburn: ["6 night maps", "Rain, fog & storms", "Quests in every map", "Garage & upgrades", "Real 3D"],
  kingdomsofash: ["Build your own harbour town", "Towers, bridges & gardens", "Day & night", "Photo mode", "No timer, no enemies"],
};

// Deliberately its own component rather than another GameCard prop
// variant — flagship games need to look genuinely different (bigger,
// its own section) from an ordinary rail entry, not just "GameCard
// but slightly bigger." But the distinction should read as quality,
// not a shouted label: no explicit "FLAGSHIP" badge text, a thin
// tinted border instead of a bold full-color one, and a quiet glow
// on the icon rather than a loud pill — the design should make it
// obvious without saying it out loud.
export default function FlagshipBanner({ games, bestByGame }) {
  const flagshipGames = FLAGSHIP_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(Boolean);
  if (flagshipGames.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-mono text-[11px] text-textDim mb-3">Featured</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {flagshipGames.map((game, idx) => {
          const hero = idx === 0 && HERO_PITCH[game.slug];
          return (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className={`relative rounded-xl border p-6 flex flex-col gap-3 bg-bgPanel hover:-translate-y-0.5 transition-transform overflow-hidden ${hero ? "sm:col-span-2 lg:col-span-3 sm:p-8" : ""}`}
            style={hero
              ? { borderColor: `${game.accentColor}70`, background: `radial-gradient(ellipse at 85% 0%, ${game.accentColor}33 0%, #1d1046 55%)` }
              : { borderColor: `${game.accentColor}40` }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-bgPanel3 animate-glow"
              style={{ color: game.accentColor }}
            >
              {game.icon}
            </div>
            <div>
              <h3 className={`font-pixel mb-1 ${hero ? "text-lg sm:text-xl" : "text-sm"}`} style={{ color: game.accentColor }}>
                {game.name}
              </h3>
              <p className="text-sm text-textDim">{game.tagline}</p>
            </div>
            {hero && (
              <div className="flex flex-wrap gap-2">
                {HERO_PITCH[game.slug].map((t) => (
                  <span key={t} className="font-mono text-[10px] px-2.5 py-1 rounded-full border text-textLight" style={{ borderColor: `${game.accentColor}60` }}>{t}</span>
                ))}
              </div>
            )}
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
          );
        })}
      </div>
    </div>
  );
}
