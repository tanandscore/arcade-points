"use client";

import { useEffect, useRef, useState } from "react";
import {
  FINISHES, ROOFS, LIVERIES, RIM_STYLES, RIM_SIZES, CAMBERS, STANCES, WINGS, KITS, HOODS, EXHAUSTS, MIRRORS, LIGHTS, TINTS, GLOWS,
  PAINT_COLORS, RIM_COLORS, LIVERY_COLORS, CALIPER_COLORS, createShowroom,
} from "@/midnightburn/engine/cars";

// Garage pieces for Midnight Burn: the live 3D showroom, the
// customise panel and the ladder list. Pure presentation — the game
// state lives in MidnightBurn.js.

const GROUPS = {
  finish: FINISHES, roof: ROOFS, livery: LIVERIES, rims: RIM_STYLES, rimsize: RIM_SIZES, camber: CAMBERS, stance: STANCES,
  wing: WINGS, kit: KITS, hood: HOODS, exhaust: EXHAUSTS, mirrors: MIRRORS, lights: LIGHTS, tint: TINTS, glow: GLOWS,
};
export const looksKeys = (s) => [
  ["finish", s.finish], ["roof", s.roof || "body"], ["livery", s.livery.type], ["rims", s.rims.style], ["rimsize", s.rims.size ?? 1], ["camber", s.camber | 0], ["stance", s.stance || "stock"],
  ["wing", s.wing], ["kit", s.kit], ["hood", s.hood || "stock"], ["exhaust", s.exhaust || "stock"], ["mirrors", s.mirrors || "body"], ["lights", s.lights || "white"],
  ["tint", s.tint], ["glow", s.glow],
];
export const costOf = (group, id) => (GROUPS[group].find((o) => o.id === id)?.cost) || 0;
export const isOwned = (owned, group, id) => costOf(group, id) === 0 || owned.includes(`${group}:${id}`);
// options in `draft` that the player has not paid for yet
export function pendingItems(draft, owned) {
  return looksKeys(draft).filter(([g, id]) => !isOwned(owned, g, id)).map(([g, id]) => ({ group: g, id, cost: costOf(g, id) }));
}

// a colour from two sliders: hue and lightness (always a strong, saturated paint)
const hslHex = (h, l) => { const a = 0.9 * Math.min(l, 1 - l); const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); }; return `#${f(0)}${f(8)}${f(4)}`; };

export function Showroom({ spec, height = 300, auto = true, className = "" }) {
  const mountRef = useRef(null);
  const shRef = useRef(null);
  const first = useRef(spec);
  const drag = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let sh = null, ro = null;
    try {
      sh = createShowroom(mountRef.current, first.current, { auto });
      shRef.current = sh;
      ro = new ResizeObserver(() => sh && sh.resize());
      ro.observe(mountRef.current);
    } catch { setFailed(true); }
    return () => { ro && ro.disconnect(); sh && sh.dispose(); shRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (spec !== first.current) { shRef.current && shRef.current.setSpec(spec); first.current = spec; }
  }, [spec]);

  const down = (e) => { drag.current = { x: e.clientX, a: shRef.current ? shRef.current.getAngle() : 0 }; shRef.current && shRef.current.setAuto(false); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (drag.current && shRef.current) shRef.current.setAngle(drag.current.a - (e.clientX - drag.current.x) * 0.01); };
  const up = () => { drag.current = null; };
  return (
    <div className={`relative rounded-xl border border-lineColor overflow-hidden bg-black ${className}`} style={{ height }}>
      <div ref={mountRef} className="absolute inset-0 cursor-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {failed && <p className="absolute inset-0 flex items-center justify-center text-center p-4 font-mono text-[11px] text-textDim">3D preview unavailable in this browser.</p>}
      <p className="absolute bottom-1.5 right-2 text-[9px] font-mono text-white/40 pointer-events-none">drag to turn</p>
    </div>
  );
}

function Chip({ label, sub, active, owned, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-2 py-1 text-left transition-colors hover:bg-bgPanel3"
      style={{ borderColor: active ? accent : "#2a2a44", background: active ? "rgba(255,255,255,0.07)" : undefined }}
    >
      <span className="block font-mono text-[10px] text-textLight leading-tight">{label}</span>
      <span className="block font-mono text-[9px] leading-tight" style={{ color: owned ? "#6bff6b" : "#ffb703" }}>{sub ?? (owned ? "owned" : "")}</span>
    </button>
  );
}

function Swatches({ colors, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} onClick={() => onPick(c)} aria-label={`Colour ${c}`} className="w-5 h-5 rounded-full border-2"
          style={{ background: c, borderColor: value === c ? "#fff" : "#2a2a44" }} />
      ))}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="mb-3">
      <p className="font-pixel text-[8px] text-accentCyan mb-1.5">{title}</p>
      {children}
    </div>
  );
}

// draft is the look being tried on; owned is the list of paid options.
const TABS = [["paint", "PAINT"], ["body", "BODY"], ["wheels", "WHEELS"], ["lights", "LIGHTS & GLASS"]];
export function CustomisePanel({ draft, owned, accent, onChange, currency = "$" }) {
  const [tab, setTab] = useState("paint");
  const [hue, setHue] = useState(190); const [lum, setLum] = useState(0.55);
  const opt = (group, list, current, setter, extra) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((o) => {
        const have = isOwned(owned, group, o.id);
        return (
          <Chip key={String(o.id)} label={o.name} accent={accent} active={current === o.id} owned={have}
            sub={have ? (o.note || "owned") : `${currency}${o.cost}${o.note ? " · " + o.note : ""}`}
            onClick={() => setter(o.id)} />
        );
      })}
      {extra}
    </div>
  );
  const set = (patch) => onChange({ ...draft, ...patch });
  const rims = (patch) => set({ rims: { ...draft.rims, ...patch } });
  return (
    <div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="font-pixel text-[8px] px-2.5 py-1.5 rounded border"
            style={{ borderColor: tab === k ? accent : "#2a2a44", color: tab === k ? "#07070f" : "#aab", background: tab === k ? accent : "transparent" }}>{l}</button>
        ))}
      </div>
      <div className="max-h-[400px] overflow-y-auto pr-1">
        {tab === "paint" && (<>
          <Group title="PAINT COLOUR">
            <Swatches colors={PAINT_COLORS} value={draft.color} onPick={(c) => set({ color: c })} />
            <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-textDim flex-wrap">
              CUSTOM
              <input type="range" min="0" max="359" value={hue} aria-label="Hue" onChange={(e) => { const h = +e.target.value; setHue(h); set({ color: hslHex(h, lum) }); }} className="w-28" />
              <input type="range" min="12" max="85" value={Math.round(lum * 100)} aria-label="Lightness" onChange={(e) => { const l = +e.target.value / 100; setLum(l); set({ color: hslHex(hue, l) }); }} className="w-20" />
              <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: draft.color }} />
            </div>
          </Group>
          <Group title="FINISH">{opt("finish", FINISHES, draft.finish, (id) => set({ finish: id }))}</Group>
          <Group title="ROOF">{opt("roof", ROOFS, draft.roof || "body", (id) => set({ roof: id }))}</Group>
          <Group title="LIVERY">
            {opt("livery", LIVERIES, draft.livery.type, (id) => set({ livery: { ...draft.livery, type: id } }))}
            {draft.livery.type !== "none" && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Swatches colors={LIVERY_COLORS} value={draft.livery.color} onPick={(c) => set({ livery: { ...draft.livery, color: c } })} />
                {(draft.livery.type === "racing" || draft.livery.type === "rally") && (
                  <div className="flex items-center gap-1 font-mono text-[10px] text-textDim">
                    NUMBER
                    <button className="px-1.5 border border-lineColor rounded" onClick={() => set({ number: (draft.number + 99) % 100 })}>−</button>
                    <span className="w-5 text-center text-textLight">{draft.number}</span>
                    <button className="px-1.5 border border-lineColor rounded" onClick={() => set({ number: (draft.number + 1) % 100 })}>+</button>
                  </div>
                )}
              </div>
            )}
          </Group>
        </>)}
        {tab === "body" && (<>
          <Group title="BODY KIT">{opt("kit", KITS, draft.kit, (id) => set({ kit: id }))}</Group>
          <Group title="WING">{opt("wing", WINGS, draft.wing, (id) => set({ wing: id }))}</Group>
          <Group title="BONNET">{opt("hood", HOODS, draft.hood || "stock", (id) => set({ hood: id }))}</Group>
          <Group title="MIRRORS">{opt("mirrors", MIRRORS, draft.mirrors || "body", (id) => set({ mirrors: id }))}</Group>
          <Group title="EXHAUST">{opt("exhaust", EXHAUSTS, draft.exhaust || "stock", (id) => set({ exhaust: id }))}</Group>
          <Group title="RIDE HEIGHT (looks only)">{opt("stance", STANCES, draft.stance || "stock", (id) => set({ stance: id }))}</Group>
        </>)}
        {tab === "wheels" && (<>
          <Group title="RIM STYLE">{opt("rims", RIM_STYLES, draft.rims.style, (id) => rims({ style: id }))}</Group>
          <Group title="RIM COLOUR"><Swatches colors={RIM_COLORS} value={draft.rims.color} onPick={(c) => rims({ color: c })} /></Group>
          <Group title="RIM SIZE">{opt("rimsize", RIM_SIZES, draft.rims.size ?? 1, (id) => rims({ size: id }))}</Group>
          <Group title="WHEEL TILT (CAMBER)">{opt("camber", CAMBERS, draft.camber | 0, (id) => set({ camber: id }))}</Group>
          <Group title="BRAKE CALIPERS">
            <div className="flex flex-wrap gap-1.5 items-center">
              {CALIPER_COLORS.map((c) => c === "auto"
                ? <button key={c} onClick={() => set({ caliper: "auto" })} className="font-mono text-[9px] px-2 h-5 rounded-full border-2 text-textLight" style={{ borderColor: (draft.caliper || "auto") === "auto" ? "#fff" : "#2a2a44" }}>AUTO</button>
                : <button key={c} onClick={() => set({ caliper: c })} aria-label={`Caliper ${c}`} className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: draft.caliper === c ? "#fff" : "#2a2a44" }} />)}
            </div>
          </Group>
        </>)}
        {tab === "lights" && (<>
          <Group title="HEADLIGHTS">{opt("lights", LIGHTS, draft.lights || "white", (id) => set({ lights: id }))}</Group>
          <Group title="WINDOW TINT">{opt("tint", TINTS, draft.tint, (id) => set({ tint: id }))}</Group>
          <Group title="UNDERGLOW">{opt("glow", GLOWS, draft.glow, (id) => set({ glow: id }))}</Group>
        </>)}
      </div>
    </div>
  );
}

const hexCss = (n) => (typeof n === "number" ? "#" + n.toString(16).padStart(6, "0") : n);

// The ladder, #1 at the top, #10 at the bottom, like climbing.
export function LadderPanel({ drivers, beaten, level, onPick, carNames }) {
  const next = drivers.find((d) => d.rank === 10 - beaten);
  return (
    <div className="max-h-[430px] overflow-y-auto pr-1 flex flex-col gap-1.5">
      {[...drivers].sort((a, b) => a.rank - b.rank).map((d) => {
        const done = beaten >= 11 - d.rank;
        const isNext = next && next.rank === d.rank;
        const lvOk = level >= d.reqLevel;
        const open = done || (isNext && lvOk);
        const status = done ? "BEATEN ✓" : isNext ? (lvOk ? "CHALLENGE ▸" : `NEEDS LEVEL ${d.reqLevel}`) : "LOCKED";
        return (
          <button
            key={d.id}
            disabled={!open}
            onClick={() => onPick(d)}
            className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-45"
            style={{ borderColor: isNext && lvOk ? "#ff2d95" : "#2a2a44", background: isNext ? "rgba(255,45,149,0.08)" : undefined }}
          >
            <span className="font-pixel text-sm w-8 text-center" style={{ color: d.accent }}>#{d.rank}</span>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.accent, boxShadow: `0 0 8px ${d.accent}` }} />
            <span className="flex-1 min-w-0">
              <span className="block font-mono text-[12px] text-textLight">{d.name} <span className="text-textDim">· {d.title}</span></span>
              <span className="block font-mono text-[10px] text-textDim truncate">{carNames[d.car.car]} · {d.style}</span>
            </span>
            <span className="text-right shrink-0">
              <span className="block font-mono text-[10px]" style={{ color: done ? "#6bff6b" : isNext && lvOk ? "#ff2d95" : "#8a8aa8" }}>{status}</span>
              <span className="block font-mono text-[9px] text-textDim">Lv {d.reqLevel} · ${d.reward.cash.toLocaleString()}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
