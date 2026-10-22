import Link from "next/link";
import { LEGEND_FLAGSHIP_SLUGS } from "@/lib/flagshipSlugs";
import FlagshipArt from "@/components/FlagshipArt";

// The first slug is THE flagship of the site: a wide hero card with its own pitch line. The rest sit beneath it as three equal cards.
// Each card carries a drawn scene (components/FlagshipArt.js) in the game's own colour on the site's deep purple.
const FLAGSHIP_SLUGS = LEGEND_FLAGSHIP_SLUGS;
const PITCH = {
  midnightburn: ["6 night maps", "Rain, fog & storms", "Quests in every map", "Garage & upgrades", "Real 3D"],
  operationblacksite: ["Buy phase", "Plant & defuse", "Smart bots", "Real 3D"],
  kingdomsofash: ["Build a kingdom", "Day & night", "Calm & deep"],
  wrathofolympus: ["Divine powers", "Heroes & gods", "Fog of war"],
};

// Deliberately its own component rather than another GameCard variant: the big games should read as quality, not as a shouted label.
export default function FlagshipBanner({ games, bestByGame }) {
  const flagshipGames = FLAGSHIP_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(Boolean);
  if (flagshipGames.length === 0) return null;
  const showBest = bestByGame && Object.keys(bestByGame).length > 0;

  return (
    <div className="mb-12">
      <div className="flex items-end justify-between mb-4 gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-textDim">Featured</h2>
        <p className="font-mono text-[10px] text-textDim">Legend Pass · best on a laptop or desktop</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {flagshipGames.map((game, idx) => {
          const hero = idx === 0;
          const a = game.accentColor;
          const pitch = PITCH[game.slug] || [];
          return (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className={`group relative overflow-hidden rounded-2xl border bg-bgPanel transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-22px_var(--fa)] focus-visible:-translate-y-1 ${hero ? "sm:col-span-2 lg:col-span-3 flex flex-col md:flex-row min-h-[260px]" : "flex flex-col"}`}
              style={{ borderColor: `${a}55`, "--fa": a }}
            >
              <div className={`relative overflow-hidden shrink-0 ${hero ? "h-44 md:h-auto md:order-2 md:w-[48%]" : "h-36"}`}>
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
                  <FlagshipArt slug={game.slug} color={a} icon={game.icon} />
                </div>
                <div className={`absolute inset-0 pointer-events-none ${hero ? "bg-gradient-to-b md:bg-gradient-to-r from-transparent via-transparent to-bgPanel md:from-bgPanel md:via-bgPanel/10 md:to-transparent" : "bg-gradient-to-b from-transparent to-bgPanel"}`} />
                <span className="absolute top-3 left-3 font-mono text-[9px] tracking-wide px-2 py-1 rounded-full border bg-black/45 backdrop-blur-sm text-textLight" style={{ borderColor: `${a}80` }}>
                  LEGEND PASS
                </span>
              </div>
              <div className={`relative flex flex-col gap-3 ${hero ? "p-6 sm:p-8 md:flex-1 md:justify-center md:order-1" : "p-5 pt-3 flex-1"}`}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-bgPanel3 shrink-0 animate-glow" style={{ color: a }}>{game.icon}</span>
                  <h3 className={`font-pixel leading-snug ${hero ? "text-base sm:text-xl" : "text-[11px] sm:text-xs"}`} style={{ color: a }}>{game.name}</h3>
                </div>
                <p className={`text-textDim ${hero ? "text-sm sm:text-base max-w-md" : "text-sm line-clamp-3"}`}>{game.tagline}</p>
                {pitch.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pitch.slice(0, hero ? 5 : 3).map((t) => (
                      <span key={t} className="font-mono text-[10px] px-2.5 py-1 rounded-full border text-textLight bg-white/[0.03]" style={{ borderColor: `${a}55` }}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <span className="font-pixel text-[9px] inline-block px-4 py-2.5 rounded-md text-bgDeep transition-[filter] group-hover:brightness-110" style={{ background: a }}>PLAY ▸</span>
                  {showBest && (
                    <span className="font-mono text-[11px] text-textDim">Best <span className="text-textLight">{(bestByGame[game.slug] || 0).toLocaleString()}</span></span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
