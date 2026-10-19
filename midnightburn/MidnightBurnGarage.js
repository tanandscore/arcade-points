"use client";

import { useEffect, useRef, useState } from "react";
import {
  FINISHES, LIVERIES, RIM_STYLES, WINGS, KITS, TINTS, GLOWS,
  PAINT_COLORS, RIM_COLORS, LIVERY_COLORS, createShowroom,
} from "@/midnightburn/engine/cars";

// Garage pieces for Midnight Burn: the live 3D showroom, the
// customise panel and the ladder list. Pure presentation — the game
// state lives in MidnightBurn.js.

const GROUPS = {
  finish: FINISHES, livery: LIVERIES, rims: RIM_STYLES, wing: WINGS, kit: KITS, tint: TINTS, glow: GLOWS,
};
export const looksKeys = (s) => [
  ["finish", s.finish], ["livery", s.livery.type], ["rims", s.rims.style],
  ["wing", s.wing], ["kit", s.kit], ["tint", s.tint], ["glow", s.glow],
];
export const costOf = (group, id) => (GROUPS[group].find((o) => o.id === id)?.cost) || 0;
export const isOwned = (owned, group, id) => costOf(group, id) === 0 || owned.includes(`${group}:${id}`);
// options in `draft` that the player has not paid for yet
export function pendingItems(draft, owned) {
  return looksKeys(draft).filter(([g, id]) => !isOwned(owned, g, id)).map(([g, id]) => ({ group: g, id, cost: costOf(g, id) }));
}

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
export function CustomisePanel({ draft, owned, accent, onChange, currency = "$" }) {
  const opt = (group, list, current, setter, extra) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((o) => {
        const have = isOwned(owned, group, o.id);
        return (
          <Chip key={o.id} label={o.name} accent={accent} active={current === o.id} owned={have}
            sub={have ? (o.note || "owned") : `${currency}${o.cost}${o.note ? " · " + o.note : ""}`}
            onClick={() => setter(o.id)} />
        );
      })}
      {extra}
    </div>
  );
  return (
    <div className="max-h-[430px] overflow-y-auto pr-1">
      <Group title="PAINT">
        <Swatches colors={PAINT_COLORS} value={draft.color} onPick={(c) => onChange({ ...draft, color: c })} />
      </Group>
      <Group title="FINISH">{opt("finish", FINISHES, draft.finish, (id) => onChange({ ...draft, finish: id }))}</Group>
      <Group title="LIVERY">
        {opt("livery", LIVERIES, draft.livery.type, (id) => onChange({ ...draft, livery: { ...draft.livery, type: id } }))}
        {draft.livery.type !== "none" && (
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <Swatches colors={LIVERY_COLORS} value={draft.livery.color} onPick={(c) => onChange({ ...draft, livery: { ...draft.livery, color: c } })} />
            {draft.livery.type === "racing" && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-textDim">
                NUMBER
                <button className="px-1.5 border border-lineColor rounded" onClick={() => onChange({ ...draft, number: (draft.number + 99) % 100 })}>−</button>
                <span className="w-5 text-center text-textLight">{draft.number}</span>
                <button className="px-1.5 border border-lineColor rounded" onClick={() => onChange({ ...draft, number: (draft.number + 1) % 100 })}>+</button>
              </div>
            )}
          </div>
        )}
      </Group>
      <Group title="WHEELS">
        {opt("rims", RIM_STYLES, draft.rims.style, (id) => onChange({ ...draft, rims: { ...draft.rims, style: id } }))}
        <div className="mt-2"><Swatches colors={RIM_COLORS} value={draft.rims.color} onPick={(c) => onChange({ ...draft, rims: { ...draft.rims, color: c } })} /></div>
      </Group>
      <Group title="WING">{opt("wing", WINGS, draft.wing, (id) => onChange({ ...draft, wing: id }))}</Group>
      <Group title="BODY KIT">{opt("kit", KITS, draft.kit, (id) => onChange({ ...draft, kit: id }))}</Group>
      <Group title="WINDOW TINT">{opt("tint", TINTS, draft.tint, (id) => onChange({ ...draft, tint: id }))}</Group>
      <Group title="UNDERGLOW">{opt("glow", GLOWS, draft.glow, (id) => onChange({ ...draft, glow: id }))}</Group>
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
