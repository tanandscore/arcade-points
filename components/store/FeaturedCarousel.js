"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TierBadge from "./TierBadge";
import SafeImg from "./SafeImg";
import { DrawnArt } from "./Capsule";
import { ChevronLeft, ChevronRight, PlayIcon, LockIcon } from "./Icons";

const SLIDE_MS = 7000;

// The big rotating showcase at the top of the store. One game fills the stage; the list on the right (wide screens) or the swipe
// (phones) moves between them. It advances by itself every 7 seconds, stops while the pointer or keyboard focus is on it,
// and never advances at all if the visitor asked their device for reduced motion.
// A slide may carry a short looping gameplay clip (`clip`); it is only loaded for the slide that is showing.
export default function FeaturedCarousel({ slides }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const [saveData, setSaveData] = useState(false);
  const root = useRef(null);
  const touch = useRef(null);
  const n = slides.length;

  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const on = (e) => setReduced(e.matches);
      mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
      setSaveData(!!(navigator.connection && navigator.connection.saveData));
      return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
    } catch { return undefined; }
  }, []);

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  const go = useCallback((k) => setI(((k % n) + n) % n), [n]);
  const next = useCallback(() => setI((x) => (x + 1) % n), [n]);
  const prev = useCallback(() => setI((x) => (x - 1 + n) % n), [n]);

  if (!n) return null;
  const autoplay = n > 1 && !reduced;
  const paused = hold || !inView;

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Featured games"
      className="grid lg:grid-cols-[minmax(0,1fr)_296px] gap-4"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHold(false); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); } }}
    >
      <div
        className="relative overflow-hidden rounded-[20px] min-h-[470px] sm:min-h-[500px] lg:min-h-[470px] bg-[#150a35]"
        style={{ boxShadow: `0 0 0 1px rgba(190,180,255,.16), 0 30px 70px -40px ${slides[i].accentColor}` }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; setHold(true); }}
        onTouchEnd={(e) => {
          const x0 = touch.current; touch.current = null; setHold(false);
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (Math.abs(dx) > 48) (dx < 0 ? next : prev)();
        }}
      >
        {slides.map((s, k) => {
          const active = k === i;
          return (
            <div
              key={s.slug}
              role="group"
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${n}: ${s.name}`}
              aria-hidden={!active}
              className="absolute inset-0 transition-opacity duration-700 ease-out"
              style={{ opacity: active ? 1 : 0, pointerEvents: active ? "auto" : "none", zIndex: active ? 2 : 1 }}
            >
              {s.clip && active && !reduced && !saveData ? (
                <video src={s.clip} poster={s.capsule} muted loop playsInline autoPlay preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <SafeImg src={s.capsule} loading={k === 0 ? "eager" : "lazy"} decoding="async" draggable="false" className="absolute inset-0 w-full h-full object-cover" fallback={<DrawnArt accent={s.accentColor} icon={s.icon} size={96} />} />
              )}
              <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(14,7,34,.94) 0%, rgba(14,7,34,.7) 34%, rgba(14,7,34,.08) 70%, rgba(14,7,34,0) 100%), linear-gradient(0deg, rgba(14,7,34,.82) 0%, rgba(14,7,34,0) 46%)" }} />
              <div className="absolute inset-x-0 bottom-0 p-6 pb-10 sm:p-10 sm:pb-12 max-w-[680px]">
                <div className="flex items-center gap-2 mb-3.5">
                  <TierBadge tier={s.tier} size="lg" />
                  {s.isNew && <span className="st-flag" style={{ height: 28, fontSize: 13, padding: "0 12px" }}>New</span>}
                </div>
                <h2 className="st-h1" style={{ fontSize: "clamp(2.1rem, 5vw, 3.7rem)" }}>{s.name}</h2>
                <p className="mt-3 text-[15.5px] sm:text-[17px] leading-relaxed text-[#e6e0ff] max-w-[46ch]">{s.tagline}</p>
                {s.pitch?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {s.pitch.slice(0, 3).map((t) => <span key={t} className="st-chip" style={{ background: "rgba(10,5,32,.55)" }}>{t}</span>)}
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-3" style={{ "--acc": s.accentColor }}>
                  <Link href={s.cta.href} className="st-btn st-btn-primary" tabIndex={active ? 0 : -1}>
                    {s.cta.locked ? <LockIcon size={17} /> : <PlayIcon size={17} />} {s.cta.label}
                  </Link>
                  <Link href={s.details} className="st-btn st-btn-ghost" tabIndex={active ? 0 : -1}>Details</Link>
                </div>
              </div>
            </div>
          );
        })}

        {n > 1 && (
          <>
            {/* top-right corner, so the arrows never sit on top of the game title */}
            <div className="hidden sm:flex absolute top-4 right-4 z-10 gap-2">
              <button type="button" onClick={prev} aria-label="Previous game" className="w-10 h-10 rounded-full flex items-center justify-center bg-black/45 hover:bg-black/70 text-white transition-colors"><ChevronLeft size={20} /></button>
              <button type="button" onClick={next} aria-label="Next game" className="w-10 h-10 rounded-full flex items-center justify-center bg-black/45 hover:bg-black/70 text-white transition-colors"><ChevronRight size={20} /></button>
            </div>
            <div className="absolute left-0 right-0 bottom-0 z-10 h-[4px] bg-white/10" aria-hidden>
              {autoplay && (
                <i
                  key={i}
                  className="st-fill block h-full"
                  style={{ background: slides[i].accentColor, "--dur": `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                  onAnimationEnd={next}
                />
              )}
            </div>
            <div className="lg:hidden absolute right-4 bottom-5 z-10 flex gap-1.5">
              {slides.map((s, k) => (
                <button key={s.slug} type="button" aria-label={`Show ${s.name}`} aria-current={k === i} onClick={() => go(k)} className="h-2.5 rounded-full transition-all" style={{ width: k === i ? 22 : 10, background: k === i ? "#fff" : "rgba(255,255,255,.4)" }} />
              ))}
            </div>
          </>
        )}
      </div>

      {n > 1 && (
        <ul className="hidden lg:flex flex-col gap-2">
          {slides.map((s, k) => {
            const active = k === i;
            return (
              <li key={s.slug} className="flex-1 min-h-0">
                <button
                  type="button"
                  onClick={() => go(k)}
                  aria-current={active}
                  className="w-full h-full flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors"
                  style={{ background: active ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.035)", boxShadow: active ? `inset 0 0 0 1.5px ${s.accentColor}` : "inset 0 0 0 1px rgba(190,180,255,.1)" }}
                >
                  <span className="st-art !rounded-lg shrink-0 w-[104px]" style={{ boxShadow: "none" }}>
                    <SafeImg src={s.capsule} loading="lazy" decoding="async" draggable="false" fallback={<DrawnArt accent={s.accentColor} icon={s.icon} size={26} />} />
                  </span>
                  <span className="min-w-0">
                    <span className="block st-h3 truncate" style={{ opacity: active ? 1 : 0.85 }}>{s.name}</span>
                    <span className="block text-[12.5px] st-muted truncate">{s.genre}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
