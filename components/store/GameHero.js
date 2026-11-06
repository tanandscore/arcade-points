"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameRunner from "@/games/GameRunner";
import Capsule from "./Capsule";
import TierBadge from "./TierBadge";
import { PlayIcon, ChevronLeft, ChevronRight, DesktopIcon, PhoneIcon } from "./Icons";

// The top of a game page, in the style of a store page: the pictures on the left, the facts and the big button on the right.
// Press Play and the game opens in the same frame, so there is nowhere to navigate and nothing to wait for.
//   canPlay  true  → the big button starts the game here
//   action   (for everything else) a ready-made box from the server: sign up, buy the pass, "updating", countdown, …
//   autoPlay true  → the page was opened with ?play=1 and the player is allowed in, so the game starts straight away

function Shot({ shot, game, priority }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [shot?.src]);
  if (bad || !shot?.src) return <Capsule game={{ ...game, status: "soon", capsule: null }} />;
  return <img src={shot.src} alt={shot.alt || game.name} onError={() => setBad(true)} loading={priority ? "eager" : "lazy"} decoding="async" draggable="false" className="absolute inset-0 w-full h-full object-cover" />;
}

export default function GameHero({ game, canPlay, autoPlay = false, action = null, related = [], best = 0, cleared = null }) {
  const router = useRouter();
  const [playing, setPlaying] = useState(!!(canPlay && autoPlay));
  const [i, setI] = useState(0);
  const top = useRef(null);
  const soon = game.status === "soon";
  const shots = soon ? [] : game.shots?.length ? game.shots : game.capsule ? [{ src: game.capsule, alt: game.name, cap: "" }] : [];
  const n = shots.length;
  const shot = shots[Math.min(i, Math.max(0, n - 1))];

  const clearPlayParam = () => { try { window.history.replaceState(null, "", window.location.pathname); } catch {} };
  const start = useCallback(() => {
    setPlaying(true);
    clearPlayParam();
    requestAnimationFrame(() => top.current && top.current.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, []);
  const leave = useCallback(() => {
    setPlaying(false);
    clearPlayParam();
    router.refresh(); // the leaderboard and "your progress" on this page pick up what was just played
    requestAnimationFrame(() => top.current && top.current.scrollIntoView({ block: "start" }));
  }, [router]);

  useEffect(() => { if (autoPlay && canPlay) clearPlayParam(); }, [autoPlay, canPlay]);

  const go = (k) => setI(((k % n) + n) % n);

  if (playing && canPlay) {
    return (
      <div ref={top} className="scroll-mt-16" id="play">
        <GameRunner slug={game.slug} name={game.name} accentColor={game.accentColor} icon={game.icon} tagline={game.tagline} related={related} onExit={leave} />
      </div>
    );
  }

  const stats = (game.stats || []).slice(0, 3);
  const modes = game.modes?.length ? game.modes : ["Single-player"];
  const facts = [
    ["Pass", <TierBadge key="p" tier={game.tier} />],
    ["Style", game.style || game.genre],
    ["Plays on", game.desktopOnly
      ? <span key="d" className="inline-flex items-center gap-2"><DesktopIcon size={16} /> Laptop or desktop</span>
      : <span key="d" className="inline-flex items-center gap-2"><PhoneIcon size={16} /><DesktopIcon size={16} /> Phone, tablet, desktop</span>],
    // "Single-player" is the normal case, so the row only appears when a game has something more to say (co-op, versus, online).
    ...(modes.length > 1 || modes[0] !== "Single-player" ? [["Modes", modes.join(", ")]] : []),
  ];

  return (
    <div ref={top} className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6 items-start" style={{ "--acc": game.accentColor }}>
      <div className="min-w-0">
        <div
          className="relative rounded-2xl overflow-hidden aspect-video bg-[#150a35]"
          style={{ boxShadow: `0 0 0 1px rgba(190,180,255,.16), 0 40px 80px -52px ${game.accentColor}` }}
          role="group"
          aria-roledescription="gallery"
          aria-label={`${game.name} pictures`}
          onKeyDown={(e) => { if (n < 2) return; if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); } }}
        >
          {soon ? <Capsule game={game} /> : <Shot shot={shot} game={game} priority />}
          {!soon && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(0deg, rgba(14,7,34,.7) 0%, rgba(14,7,34,0) 38%)" }} />
          )}
          {canPlay && !soon && (
            <button
              type="button"
              onClick={start}
              aria-label={`Play ${game.name}`}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 focus-visible:outline-none"
            >
              <span className="w-[76px] h-[76px] rounded-full flex items-center justify-center text-[#0c0620] transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110" style={{ background: game.accentColor, boxShadow: `0 18px 50px -12px ${game.accentColor}` }}>
                <PlayIcon size={32} />
              </span>
              <span className="st-chip !h-7 !text-[13px] font-semibold" style={{ background: "rgba(10,5,32,.7)" }}>Plays right here in your browser</span>
            </button>
          )}
          {soon && (
            <div className="absolute left-4 bottom-4"><span className="st-flag" style={{ height: 28, fontSize: 13, padding: "0 12px" }}>Coming soon</span></div>
          )}
          {shot?.cap && !soon && <span className={`absolute left-4 bottom-4 st-chip${canPlay ? " pointer-events-none" : ""}`} style={{ background: "rgba(10,5,32,.7)" }}>{shot.cap}</span>}
          {n > 1 && (
            <>
              <button type="button" onClick={() => go(i - 1)} aria-label="Previous picture" className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden sm:flex items-center justify-center bg-black/45 hover:bg-black/70 text-white transition-colors"><ChevronLeft size={20} /></button>
              <button type="button" onClick={() => go(i + 1)} aria-label="Next picture" className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden sm:flex items-center justify-center bg-black/45 hover:bg-black/70 text-white transition-colors"><ChevronRight size={20} /></button>
            </>
          )}
        </div>

        {n > 1 && (
          <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1" aria-label="Pictures">
            {shots.map((s, k) => (
              <li key={s.src} className="shrink-0 w-[108px] sm:w-[128px]">
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-label={`Show picture ${k + 1}${s.cap ? `: ${s.cap}` : ""}`}
                  aria-current={k === i}
                  className="st-art !rounded-lg w-full block"
                  style={{ boxShadow: k === i ? `0 0 0 2px ${game.accentColor}` : "0 0 0 1px rgba(190,180,255,.14)", opacity: k === i ? 1 : 0.7 }}
                >
                  <Shot shot={s} game={game} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {game.tags?.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
            {game.tags.slice(0, 8).map((t) => <li key={t} className="st-chip">{t}</li>)}
          </ul>
        )}
      </div>

      <aside className="st-panel p-5 sm:p-6" aria-label={`About ${game.name}`}>
        <p className="text-[16px] leading-relaxed text-[#e6e0ff]">{game.tagline}</p>

        {stats.length > 0 && (
          <ul className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map(([v, l]) => (
              <li key={l} className="rounded-xl bg-white/[0.05] px-3 py-3 text-center">
                <p className="st-num text-[1.45rem] leading-none" style={{ color: game.accentColor }}>{v}</p>
                <p className="st-muted text-[12px] mt-2">{l}</p>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-5 text-[14px] divide-y divide-white/10">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="st-muted shrink-0">{k}</dt>
              <dd className="text-right font-semibold min-w-0">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          {canPlay && !soon ? (
            <>
              <button type="button" onClick={start} className="st-btn st-btn-primary w-full !h-[54px] !text-[16px]">
                <PlayIcon size={18} /> {best > 0 || (cleared && cleared.done > 0) ? "Continue" : "Play now"}
              </button>
              {(best > 0 || (cleared && cleared.total > 0 && cleared.done > 0)) && (
                <div className="mt-4 text-[13.5px] st-muted space-y-2">
                  {cleared && cleared.total > 0 && cleared.done > 0 && (
                    <div>
                      <div className="flex justify-between"><span>Levels cleared</span><span className="font-semibold text-[#f5f0ff]">{cleared.done} of {cleared.total}</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (cleared.done / cleared.total) * 100)}%`, background: game.accentColor }} /></div>
                    </div>
                  )}
                  {best > 0 && <div className="flex justify-between"><span>Your best</span><span className="font-mono font-semibold text-accentAmber">{best.toLocaleString()}</span></div>}
                </div>
              )}
            </>
          ) : (
            action
          )}
        </div>
      </aside>
    </div>
  );
}
