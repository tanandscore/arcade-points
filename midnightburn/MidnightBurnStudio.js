"use client";
// Midnight Burn — THE STUDIO (Upgrade 134): photo mode and instant replay in one screen.
// The game is frozen while it is open. Drag to circle the car, scroll to zoom, then save the picture.
// In a replay the last seconds of driving play back from film-style cameras; you can stop on any moment and photograph it.
import { useEffect, useRef, useState } from "react";
import { SHOTS, shotCamera, orbitCamera } from "@/midnightburn/engine/open/replay";
import { sfx } from "@/lib/sound";

const FILTERS = [
  ["NATURAL", { exp: 1, sat: 1, con: 1, vig: 1 }], ["STREET", { exp: 0.95, sat: 0.78, con: 1.14, vig: 1.35 }], ["NOIR", { exp: 1.02, sat: 0.05, con: 1.22, vig: 1.5 }],
  ["NEON", { exp: 1.08, sat: 1.3, con: 1.06, vig: 1.1 }], ["DUSTY", { exp: 1.1, sat: 0.6, con: 0.94, vig: 0.9 }],
];
const btn = (on, accent) => ({ fontFamily: "monospace", fontSize: 10, padding: "6px 10px", borderRadius: 6, border: `1px solid ${on ? accent : "rgba(255,255,255,0.22)"}`, background: on ? "rgba(255,255,255,0.14)" : "rgba(10,8,24,0.72)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" });

export function StudioPanel({ G, view, replay, mode, accent = "#2de2ff", onClose }) {
  const isReplay = mode === "replay";
  const [orbit, setOrbit] = useState({ az: 2.45, el: 0.2, dist: 7.5, fov: 42, roll: 0, px: 0, py: 0 });
  const [filter, setFilter] = useState(0); const [exp, setExp] = useState(1);
  const [free, setFree] = useState(!isReplay); const [shot, setShot] = useState(0); const [playing, setPlaying] = useState(isReplay); const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0); const [hide, setHide] = useState(false); const [saved, setSaved] = useState("");
  const S = useRef({}); S.current = { orbit, free, shot, playing, speed, isReplay };
  const tRef = useRef(0); const shotRef = useRef({ n: 0, t0: 0, P0: null, auto: true });
  const len = isReplay ? replay.length : 0;

  // start / stop
  useEffect(() => {
    G.pause = true; let ok = true;
    if (isReplay) ok = replay.begin(G);
    if (!ok) { onClose(); return; }
    let raf = 0, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; const s = S.current; const P = G.player; if (!P) return;
      if (s.isReplay) {
        if (s.playing) { tRef.current += dt * s.speed; if (tRef.current >= replay.length) { tRef.current = replay.length; setPlaying(false); } setT(tRef.current); }
        replay.seek(G, tRef.current);
        const sr = shotRef.current; if (!sr.P0 || (sr.auto && s.playing && tRef.current - sr.t0 > 4.2) || tRef.current < sr.t0) { if (sr.P0 && sr.auto && tRef.current >= sr.t0) { sr.n = (sr.n + 1) % SHOTS.length; setShot(sr.n); } sr.t0 = tRef.current; sr.P0 = { x: P.x, y: P.y, z: P.z, yaw: P.yaw, speed: P.speed }; }
      }
      view.debugCam = s.free ? orbitCamera(P, s.orbit) : shotCamera(shotRef.current.n, P, shotRef.current.P0 || P, tRef.current);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); try { if (isReplay) replay.end(G); } catch {} view.debugCam = null; try { view.setPhotoLook(null); } catch {} G.pause = false; /* the studio always hands back a running game */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const f = FILTERS[filter][1]; try { view.setPhotoLook({ ...f, exp: f.exp * exp }); } catch {} }, [filter, exp, view]);

  // drag to circle, scroll to zoom
  const drag = useRef(null);
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, o: orbit }; if (!free) { setFree(true); } };
  const move = (e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (e.buttons === 2 || e.shiftKey) setOrbit({ ...d.o, px: Math.max(-4, Math.min(4, d.o.px + dx * 0.012)), py: Math.max(-0.5, Math.min(3, d.o.py + dy * 0.012)) }); else setOrbit({ ...d.o, az: d.o.az + dx * 0.006, el: Math.max(0.02, Math.min(1.45, d.o.el + dy * 0.005)) }); };
  const up = () => { drag.current = null; };
  const wheel = (e) => { setOrbit((o) => ({ ...o, dist: Math.max(2.2, Math.min(40, o.dist * (e.deltaY > 0 ? 1.1 : 0.9))) })); if (!free) setFree(true); };

  const pickShot = (n) => { sfx.tap(); setFree(false); shotRef.current = { n, t0: tRef.current, P0: null, auto: false }; setShot(n); };
  const autoCam = () => { sfx.tap(); setFree(false); shotRef.current = { ...shotRef.current, auto: true, P0: null }; };
  const seek = (v) => { tRef.current = v; setT(v); shotRef.current.P0 = null; };
  const save = () => {
    const url = view.snap(); if (!url) { sfx.wrong(); setSaved("Could not take the picture"); return; }
    const img = new Image(); img.onload = () => { try {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const fs = Math.max(11, Math.round(img.height * 0.02)); x.font = `600 ${fs}px monospace`; x.textAlign = "right"; x.textBaseline = "bottom"; x.fillStyle = "rgba(0,0,0,0.55)"; x.fillText("MIDNIGHT BURN  ·  tapandscore.com", img.width - fs + 1, img.height - fs * 0.7 + 1); x.fillStyle = "rgba(255,255,255,0.86)"; x.fillText("MIDNIGHT BURN  ·  tapandscore.com", img.width - fs, img.height - fs * 0.7);
      const a = document.createElement("a"); const d = new Date(); a.download = `midnight-burn-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}.jpg`; a.href = c.toDataURL("image/jpeg", 0.93); document.body.appendChild(a); a.click(); a.remove();
      sfx.correct(); setSaved(`Saved ${img.width} × ${img.height} to your downloads`); window.__mbLastPhoto = { w: img.width, h: img.height, bytes: a.href.length };
    } catch { sfx.wrong(); setSaved("Could not save the picture"); } }; img.src = url;
  };
  const slider = (label, key, min, max, step) => (<label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 10, color: "#cfd3e6" }}><span style={{ width: 62 }}>{label}</span><input type="range" min={min} max={max} step={step} value={orbit[key]} onChange={(e) => { setOrbit({ ...orbit, [key]: +e.target.value }); if (!free) setFree(true); }} style={{ flex: 1 }} /></label>);
  const mmss = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}.${Math.floor((v % 1) * 10)}`;

  return (
    <div className="absolute inset-0" style={{ zIndex: 40 }} onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0" style={{ cursor: "grab" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onWheel={wheel} />
      {!hide && <>
        <div className="absolute" style={{ left: 14, top: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: accent, letterSpacing: 2 }}>{isReplay ? "🎬 INSTANT REPLAY" : "📷 PHOTO MODE"}</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>drag to circle · scroll to zoom · shift-drag to slide</span>
        </div>
        <div className="absolute" style={{ right: 14, top: 12, display: "flex", gap: 8 }}>
          <button style={btn(false, accent)} onClick={() => { sfx.tap(); setHide(true); }}>HIDE BUTTONS</button>
          <button style={{ ...btn(true, accent), borderColor: "#ffb347" }} onClick={save}>📸 SAVE PHOTO</button>
          <button style={btn(false, accent)} onClick={() => { sfx.click(); onClose(); }}>✕ BACK TO THE GAME</button>
        </div>
        <div className="absolute" style={{ left: 14, bottom: isReplay ? 118 : 16, width: 250, padding: 12, borderRadius: 10, background: "rgba(8,6,20,0.78)", border: "1px solid rgba(255,255,255,0.14)", display: "grid", gap: 7 }}>
          {slider("ZOOM LENS", "fov", 14, 90, 1)}{slider("DISTANCE", "dist", 2.2, 40, 0.1)}{slider("HEIGHT", "el", 0.02, 1.45, 0.01)}{slider("TILT", "roll", -0.5, 0.5, 0.01)}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 10, color: "#cfd3e6" }}><span style={{ width: 62 }}>BRIGHTNESS</span><input type="range" min={0.5} max={1.8} step={0.02} value={exp} onChange={(e) => setExp(+e.target.value)} style={{ flex: 1 }} /></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{FILTERS.map(([n], i) => <button key={n} style={btn(filter === i, accent)} onClick={() => { sfx.tap(); setFilter(i); }}>{n}</button>)}</div>
          {saved && <p style={{ fontFamily: "monospace", fontSize: 10, color: "#9fe8a0" }}>{saved}</p>}
        </div>
        {isReplay && (
          <div className="absolute" style={{ left: 14, right: 14, bottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(8,6,20,0.82)", border: "1px solid rgba(255,255,255,0.14)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button style={btn(true, accent)} onClick={() => { sfx.tap(); if (!playing && tRef.current >= len - 0.05) seek(0); setPlaying(!playing); }}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</button>
              <input type="range" min={0} max={Math.max(0.1, len)} step={0.01} value={t} onChange={(e) => { setPlaying(false); seek(+e.target.value); }} style={{ flex: 1 }} />
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", width: 96, textAlign: "right" }}>{mmss(t)} / {mmss(len)}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.55)" }}>SPEED</span>{[0.25, 0.5, 1].map((v) => <button key={v} style={btn(speed === v, accent)} onClick={() => { sfx.tap(); setSpeed(v); }}>{v === 1 ? "NORMAL" : v === 0.5 ? "HALF" : "SLOW-MO"}</button>)}
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.55)", marginLeft: 10 }}>CAMERA</span>
              <button style={btn(!free && shotRef.current.auto, accent)} onClick={autoCam}>AUTO CUTS</button>
              {SHOTS.map((n, i) => <button key={n} style={btn(!free && !shotRef.current.auto && shot === i, accent)} onClick={() => pickShot(i)}>{n}</button>)}
              <button style={btn(free, accent)} onClick={() => { sfx.tap(); setFree(true); }}>FREE</button>
            </div>
          </div>
        )}
      </>}
      {hide && <button className="absolute" style={{ ...btn(false, accent), right: 10, top: 10, opacity: 0.35 }} onClick={() => setHide(false)}>SHOW BUTTONS</button>}
    </div>
  );
}
