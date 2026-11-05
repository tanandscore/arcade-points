"use client";
import { useCallback, useEffect, useState } from "react";

// A responsive picture grid; click a picture to see it full screen (arrow keys / swipe buttons to move, Esc to close).
export default function GalleryGrid({ shots, accent, priority }) {
  const [open, setOpen] = useState(-1);
  const close = useCallback(() => setOpen(-1), []);
  const step = useCallback((d) => setOpen((i) => (i < 0 ? i : (i + d + shots.length) % shots.length)), [shots.length]);
  useEffect(() => {
    if (open < 0) return;
    const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close, step]);

  const [first, ...rest] = shots;
  const tile = (s, i, big) => (
    <button key={s.src} type="button" onClick={() => setOpen(i)} aria-label={`Open picture: ${s.cap}`}
      className={`group relative overflow-hidden rounded-xl border bg-bgPanel text-left focus-visible:outline focus-visible:outline-2 ${big ? "sm:col-span-2 lg:col-span-3 aspect-video" : "aspect-video"}`}
      style={{ borderColor: `${accent}55` }}>
      <img src={s.src} alt={s.alt} loading={priority && i === 0 ? "eager" : "lazy"} decoding="async" width="1920" height="1080"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
      <span className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/75 to-transparent font-mono text-[11px] text-white">{s.cap}</span>
      <span className="absolute top-3 right-3 font-mono text-[10px] px-2 py-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">⤢ Full size</span>
    </button>
  );
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {first && tile(first, 0, rest.length > 0)}
        {rest.map((s, k) => tile(s, k + 1, false))}
      </div>
      {open >= 0 && (
        <div role="dialog" aria-modal="true" aria-label={shots[open].cap} className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center p-3 sm:p-8" onClick={close}>
          <img src={shots[open].src} alt={shots[open].alt} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="absolute bottom-4 inset-x-0 text-center font-mono text-xs text-white/80 pointer-events-none">{shots[open].cap} · {open + 1}/{shots.length}</p>
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 font-mono text-sm px-3 py-2 rounded-md bg-white/10 text-white">✕</button>
          {shots.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous picture" className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 text-2xl px-3 py-3 rounded-md bg-white/10 text-white">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next picture" className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 text-2xl px-3 py-3 rounded-md bg-white/10 text-white">›</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
