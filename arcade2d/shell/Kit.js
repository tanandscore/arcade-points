"use client";
// The shared "game shell" for every 2D game: title screen, level select with stars, pause, result screen, touch controls,
// saved progress and score submission. A game only describes itself (see arcade2d/README in the upgrade doc):
//
//   createKitGame({
//     id, title, tagline, accent, music, touch: "platformer"|"gun"|"none"|[buttons],
//     controls: [["Keys","What it does"]], goal: "...", tips: ["..."],
//     worlds: [{ name, theme, levels: [{ id, name, desc }] }],
//     makeSession(level, ctx) -> { update(dt,input,env), draw(g,env), done: null | { won, score, stars, lines, title, sub, delay } },
//     createIdle(env) -> { update(dt,env), draw(g,env) }     // scenery behind the title screen (optional)
//   })
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Runtime, VIEW } from "./runtime";
import { loadSave, writeSave, syncDown, recordLevel, totalStars, emptySave } from "../core/save";
import { sfx, music, unlock } from "../core/audio";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { CSS, C, F, Btn, Stars, Chip, Lock } from "./ui";

export function createKitGame(def) {
  function KitGame(props) { return <KitShell def={def} {...props} />; }
  KitGame.displayName = `Kit(${def.id})`;
  KitGame.def = def;
  return KitGame;
}

// ---- touch buttons ----------------------------------------------------------------------------------------------------------------
const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });
export const TOUCH_PRESETS = {
  platformer: [B("left", "◀", 22, 420, 84), B("right", "▶", 124, 420, 84), B("jump", "JUMP", 834, 404, 104, { fs: 18 }), B("fire", "ACT", 726, 438, 76, { fs: 15 })],
  platformerNoAct: [B("left", "◀", 22, 420, 84), B("right", "▶", 124, 420, 84), B("jump", "JUMP", 834, 404, 104, { fs: 18 })],
  gun: [B("left", "◀", 18, 428, 82), B("right", "▶", 108, 428, 82), B("up", "▲", 63, 338, 70), B("jump", "JUMP", 846, 428, 84, { fs: 16 }), B("fire", "FIRE", 738, 414, 98, { fs: 18 }), B("alt", "BOMB", 740, 314, 66, { fs: 13 }), B("swap", "SWAP", 842, 330, 62, { fs: 12 })],
  none: [],
};

function TouchControls({ preset, input, accent }) {
  const list = Array.isArray(preset) ? preset : TOUCH_PRESETS[preset] || [];
  const held = useRef({});
  const down = (act) => (e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} if (!held.current[act]) { held.current[act] = true; input.virtual(act, true); e.currentTarget.classList.add("on"); } };
  const up = (act) => (e) => { if (held.current[act]) { held.current[act] = false; input.virtual(act, false); e.currentTarget.classList.remove("on"); } };
  useEffect(() => () => { for (const k of Object.keys(held.current)) if (held.current[k]) input.virtual(k, false); held.current = {}; }, [input]);
  return list.map((b) => (
    <div key={b.act} className="k2d-tc" role="button" aria-label={b.act} onPointerDown={down(b.act)} onPointerUp={up(b.act)} onPointerCancel={up(b.act)} onLostPointerCapture={up(b.act)}
      style={{ left: b.x, top: b.y, width: b.d, height: b.d, fontSize: b.fs || 26, pointerEvents: "auto", borderColor: b.act === "jump" || b.act === "fire" ? accent : undefined }}>{b.label}</div>
  ));
}

function useCountUp(target, ms = 900, run = true) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(target); return; }
    let raf, t0 = performance.now(); const tick = (now) => { const k = Math.min(1, (now - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms, run]);
  return v;
}

// ---- the shell --------------------------------------------------------------------------------------------------------------------
function KitShell({ def, onScore, onFinish, accentColor, onExit }) {
  const accent = def.accent || accentColor || C.cyan;
  const stage = useStage();
  const rootRef = useRef(null), canvasRef = useRef(null), rtRef = useRef(null);
  const [layout, setLayout] = useState({ s: 1, ox: 0, oy: 0 });
  const [screen, setScreen] = useState("title"); // title | levels | help | playing | result
  const [save, setSaveState] = useState(() => loadSave(def.id));
  const saveRef = useRef(save); saveRef.current = save;
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState(0);
  const [wTab, setWTab] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const [submit, setSubmit] = useState(null);
  const [touch, setTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const screenRef = useRef(screen); screenRef.current = screen;
  const finishRef = useRef(null), curRef = useRef(0), resultRef = useRef(null), selRef = useRef(0), wTabRef = useRef(0);

  const flat = useMemo(() => { const out = []; def.worlds.forEach((w, wi) => w.levels.forEach((l, li) => out.push({ ...l, wi, li, index: out.length, world: w }))); return out; }, [def]);
  const isUnlocked = useCallback((i, sv = saveRef.current) => {
    if (def.unlockAll || i === 0) return true;
    const prev = sv.levels[flat[i - 1].id]; const me = sv.levels[flat[i].id];
    if (me && (me.stars > 0 || me.best > 0)) return true;
    if (def.gate) return !!def.gate(i, sv, flat);
    return !!prev && (prev.stars > 0 || prev.best > 0);
  }, [def, flat]);
  const nextUp = useCallback((sv = saveRef.current) => { for (let i = 0; i < flat.length; i++) { const l = sv.levels[flat[i].id]; if (!(l && (l.stars > 0 || l.best > 0)) && isUnlocked(i, sv)) return i; } return flat.length - 1; }, [flat, isUnlocked]);

  const commitSave = useCallback((sv) => { setSaveState({ ...sv }); saveRef.current = sv; writeSave(def.id, sv); }, [def.id]);

  // ---- boot the runtime ----
  useEffect(() => {
    const rt = new Runtime(canvasRef.current, rootRef.current, def, {
      onLayout: (l) => setLayout({ s: l.s, ox: l.ox, oy: l.oy }),
      onPause: (p) => setPaused(p),
      onEnd: (s) => finishRef.current && finishRef.current(s),
    });
    rtRef.current = rt; rt.idle = def.createIdle ? def.createIdle(rt.env) : null; rt.env.save = saveRef.current;
    rt.attach(); rt.start();
    try { const mq = window.matchMedia("(pointer: coarse)"); setTouch(mq.matches || localStorage.getItem("k2d-force-touch") === "1"); } catch {}
    const onPtr = (e) => { if (e.pointerType === "touch") setTouch(true); };
    rt.canvas.addEventListener("pointerdown", onPtr);
    const chk = () => setPortrait(window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 800);
    chk(); window.addEventListener("resize", chk);
    syncDown(def.id).then((m) => { if (!m) return; setSaveState(m); saveRef.current = m; rt.env.save = m; setSel(nextUp(m)); setWTab(flat[nextUp(m)].wi); });
    const n0 = nextUp(saveRef.current); setSel(n0); setWTab(flat[n0].wi);
    rootRef.current && rootRef.current.focus && rootRef.current.focus({ preventScroll: true });
    return () => { rt.canvas.removeEventListener("pointerdown", onPtr); window.removeEventListener("resize", chk); rt.detach(); music.stop(); rtRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  // ---- starting / finishing levels ----
  const startLevel = useCallback((i) => {
    const rt = rtRef.current; if (!rt) return; const lv = flat[i]; if (!lv) return;
    unlock(); rt.unlockAudio();
    if (touch && stage && !stage.isFull && stage.enter) { try { stage.enter(); } catch {} } // phones: fill the screen as soon as a level starts
    setCur(i); setSel(i); setWTab(lv.wi); setResult(null); setSubmit(null); setPaused(false);
    rt.env.save = saveRef.current;
    const session = def.makeSession(lv, { save: saveRef.current, world: lv.world, index: i, flat, env: rt.env, accent });
    rt.begin(session); setScreen("playing");
    music.play(lv.music || lv.world.music || def.music || "sunny");
    if (rootRef.current) rootRef.current.focus({ preventScroll: true });
  }, [def, flat, accent, touch, stage]);

  const submitScore = useCallback(async (score) => {
    const fn = onScore || onFinish; if (!fn || !(score > 0)) return;
    setSubmit({ state: "saving" });
    try { const r = await fn(Math.round(score)); setSubmit({ state: r && r.error ? "error" : "done", ...(r || {}) }); } catch { setSubmit({ state: "error" }); }
  }, [onScore, onFinish]);

  const finishLevel = useCallback((s) => {
    const d = s.done; if (!d) return; const lv = flat[rtRef.current ? curRef.current : 0]; const sv = JSON.parse(JSON.stringify(saveRef.current));
    sv.stats.plays++; if (d.won) sv.stats.wins++; else sv.stats.deaths++;
    let rec = null;
    if (d.won) { rec = recordLevel(sv, lv.id, { stars: d.stars || 1, score: d.score || 0, time: d.time || 0 }); sv.stats.score += d.score || 0; }
    if (d.extra) Object.assign(sv.extra, d.extra);
    commitSave(sv);
    const next = d.won && curRef.current + 1 < flat.length ? curRef.current + 1 : null;
    setResult({ ...d, level: lv, rec, next, newBest: d.won ? rec.newBest : false, bestBefore: rec ? rec.prev.best : 0 });
    setScreen("result"); music.intensity && music.intensity(0.3);
    if (d.won) sfx.win(); else sfx.lose();
    if (d.won || def.submitOnLose) submitScore(d.score || 0);
  }, [flat, commitSave, def, submitScore]);
  finishRef.current = finishLevel; curRef.current = cur;

  const toLevels = useCallback(() => { const rt = rtRef.current; rt && rt.end(); setPaused(false); const n = nextUp(); setSel((p) => (isUnlocked(p) ? p : n)); setWTab(flat[isUnlocked(sel) ? sel : n].wi); setScreen("levels"); sfx.back(); }, [flat, isUnlocked, nextUp, sel]);
  const toTitle = useCallback(() => { const rt = rtRef.current; rt && rt.end(); setPaused(false); setScreen("title"); sfx.back(); }, []);
  const doPlay = useCallback(() => {
    sfx.click(); unlock();
    if (!saveRef.current.settings.seenHelp) { setScreen("help"); return; }
    startLevel(nextUp());
  }, [nextUp, startLevel]);
  const resume = useCallback(() => { const rt = rtRef.current; rt && rt.setPaused(false); setPaused(false); sfx.click(); }, []);

  // menu keyboard
  useEffect(() => {
    const onKey = (e) => {
      const sc = screenRef.current, k = e.code;
      if (sc === "playing") { if ((k === "Escape" || k === "KeyP") && rtRef.current && rtRef.current.paused) { e.preventDefault(); resume(); } return; }
      if (k === "Enter" || k === "Space") {
        e.preventDefault();
        if (sc === "title") doPlay();
        else if (sc === "levels") { if (isUnlocked(sel)) { sfx.click(); startLevel(sel); } }
        else if (sc === "help") { const sv = { ...saveRef.current, settings: { ...saveRef.current.settings, seenHelp: 1 } }; commitSave(sv); startLevel(nextUp(sv)); }
        else if (sc === "result" && resultRef.current) { const r = resultRef.current; if (r.won && r.next != null) startLevel(r.next); else startLevel(curRef.current); }
      } else if (k === "Escape") { if (sc === "levels" || sc === "help") toTitle(); else if (sc === "result") toLevels(); }
      else if (sc === "levels" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) {
        e.preventDefault(); const w = def.worlds[wTabRef.current], cols = Math.min(7, Math.ceil(w.levels.length / 2)), base = flat.findIndex((l) => l.wi === wTabRef.current), li = Math.max(0, selRef.current - base);
        let nl = li + (k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : k === "ArrowUp" ? -cols : cols); nl = Math.max(0, Math.min(w.levels.length - 1, nl)); setSel(base + nl); sfx.tick();
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [def, flat, doPlay, isUnlocked, sel, startLevel, toTitle, toLevels, resume, commitSave, nextUp]);
  resultRef.current = result; selRef.current = sel; wTabRef.current = wTab;

  const total = totalStars(save), maxStars = flat.length * 3, bestAll = Math.max(0, ...Object.values(save.levels).map((l) => l.best || 0));
  const touchPreset = def.touch ?? "platformer";
  const rt = rtRef.current;

  return (
    <div ref={rootRef} tabIndex={0} className="k2d" style={{ ...stageBoxStyle(stage.isFull, { background: "#0a0520", overflow: "hidden", outline: "none", touchAction: "none", borderRadius: stage.isFull ? 0 : 18, boxShadow: stage.isFull ? "none" : `0 0 0 1.5px rgba(190,180,255,.22), 0 30px 80px -30px ${accent}88` }) }}>
      <style>{CSS}</style>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      <div style={{ position: "absolute", left: layout.ox, top: layout.oy, width: VIEW.w, height: VIEW.h, transform: `scale(${layout.s})`, transformOrigin: "0 0", pointerEvents: "none", "--ac": accent }}>
        {screen === "title" && <TitleScreen def={def} accent={accent} save={save} total={total} maxStars={maxStars} best={bestAll} onPlay={doPlay} onLevels={() => { sfx.click(); setScreen("levels"); }} onHelp={() => { sfx.click(); setScreen("help"); }} resumeIdx={nextUp()} flat={flat} />}
        {screen === "levels" && <LevelScreen def={def} accent={accent} flat={flat} save={save} sel={sel} setSel={setSel} wTab={wTab} setWTab={setWTab} isUnlocked={isUnlocked} total={total} maxStars={maxStars} onPlay={(i) => { sfx.click(); startLevel(i); }} onBack={toTitle} />}
        {screen === "help" && <HelpScreen def={def} accent={accent} touch={touch} onGo={() => { const sv = { ...saveRef.current, settings: { ...saveRef.current.settings, seenHelp: 1 } }; commitSave(sv); sfx.click(); startLevel(nextUp(sv)); }} onBack={toTitle} first={!save.settings.seenHelp} />}
        {screen === "playing" && (
          <>
            <button type="button" aria-label="Pause" onClick={() => { rtRef.current && rtRef.current.setPaused(true); }} style={{ position: "absolute", right: 14, top: 12, width: 44, height: 44, borderRadius: 14, border: "1.5px solid rgba(190,180,255,.35)", background: "rgba(14,6,36,.55)", color: "#fff", fontSize: 16, pointerEvents: "auto", display: def.hidePauseButton ? "none" : "block" }}>❚❚</button>
            {touch && rt && touchPreset !== "none" && <TouchControls preset={touchPreset} input={rt.input} accent={accent} />}
            {paused && <PauseMenu accent={accent} onResume={resume} onRestart={() => startLevel(cur)} onLevels={toLevels} onExit={onExit} def={def} level={flat[cur]} />}
          </>
        )}
        {screen === "result" && result && <ResultScreen def={def} accent={accent} r={result} submit={submit} onNext={() => result.next != null && startLevel(result.next)} onRetry={() => startLevel(cur)} onLevels={toLevels} />}
      </div>
      {portrait && touch && screen === "playing" && <div style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", fontSize: 11, color: "#c3bbea", fontFamily: F.body, pointerEvents: "none", textShadow: "0 1px 3px #000" }}>Tip: rotate your phone sideways or tap ⛶ for fullscreen</div>}
    </div>
  );
}

// ---- screens --------------------------------------------------------------------------------------------------------------------------
const gradText = (a, b) => ({ background: `linear-gradient(180deg, #fff 8%, ${a} 55%, ${b})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" });

function TitleScreen({ def, accent, save, total, maxStars, best, onPlay, onLevels, onHelp, resumeIdx, flat }) {
  const started = Object.keys(save.levels).length > 0, lv = flat[resumeIdx];
  return (
    <div className="k2d-fade" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,5,32,.9) 0%, rgba(10,5,32,.62) 38%, rgba(10,5,32,0) 66%), linear-gradient(0deg, rgba(10,5,32,.7), rgba(10,5,32,0) 38%)" }} />
      <div style={{ position: "absolute", left: 52, top: 54, width: 470, pointerEvents: "auto" }}>
        <div style={{ fontFamily: F.pixel, fontSize: 9, letterSpacing: 2, color: accent, opacity: 0.95, marginBottom: 14 }}>{(def.genreLabel || "TAP & SCORE").toUpperCase()}</div>
        <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: def.titleSize || 78, lineHeight: 0.95, margin: 0, letterSpacing: "-.02em", ...gradText(accent, "#fff"), filter: `drop-shadow(0 6px 0 rgba(10,5,32,.65)) drop-shadow(0 0 26px ${accent}66)` }}>{def.title}</h1>
        <p style={{ fontSize: 19, lineHeight: 1.4, color: C.dim, margin: "16px 0 26px", maxWidth: 400 }}>{def.tagline}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 290 }}>
          <Btn primary accent={accent} h={64} size={26} onClick={onPlay} style={{ width: 290 }}>▶&nbsp; {started ? "CONTINUE" : "PLAY"}</Btn>
          <div style={{ display: "flex", gap: 12 }}>
            <Btn ghost h={48} size={17} onClick={onLevels} style={{ flex: 1, padding: 0 }}>Levels</Btn>
            <Btn ghost h={48} size={17} onClick={onHelp} style={{ flex: 1, padding: 0 }}>How to play</Btn>
          </div>
        </div>
        {started && <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}><Chip color={C.gold}>★ {total} / {maxStars}</Chip>{best > 0 && <Chip>Best run {best.toLocaleString()}</Chip>}{lv && <Chip color={accent}>Next: {lv.name}</Chip>}</div>}
      </div>
    </div>
  );
}

function LevelScreen({ def, accent, flat, save, sel, setSel, wTab, setWTab, isUnlocked, total, maxStars, onPlay, onBack }) {
  const world = def.worlds[wTab], list = flat.filter((l) => l.wi === wTab), cols = Math.min(7, Math.ceil(list.length / 2)), cw = Math.floor((832 - (cols - 1) * 12) / cols);
  const cur = flat[sel] || list[0];
  const worldStars = list.reduce((s, l) => s + ((save.levels[l.id] || {}).stars || 0), 0);
  return (
    <div className="k2d-fade" style={{ position: "absolute", inset: 0, background: "rgba(8,4,26,.78)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="k2d-card k2d-pop" style={{ width: 880, padding: "22px 24px 20px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Btn ghost h={42} size={15} onClick={onBack} style={{ padding: "0 16px" }}>← Back</Btn>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{def.title}</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>{world.name}{world.blurb ? ` · ${world.blurb}` : ""}</div>
          </div>
          <Chip color={C.gold} style={{ fontSize: 15 }}>★ {total} / {maxStars}</Chip>
        </div>
        {def.worlds.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {def.worlds.map((w, wi) => { const firstIdx = flat.findIndex((l) => l.wi === wi); const open = isUnlocked(firstIdx); return (
              <button key={wi} type="button" className={`k2d-tab ${wi === wTab ? "on" : ""}`} disabled={!open} style={{ opacity: open ? 1 : 0.45 }} onClick={() => { setWTab(wi); setSel(firstIdx); sfx.tick(); }}>{open ? "" : "🔒 "}{w.short || w.name}</button>
            ); })}
            <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 13, color: C.dim }}>World stars ★ {worldStars} / {list.length * 3}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: 12, minHeight: 2 * 104 + 12 }}>
          {list.map((l) => {
            const rec = save.levels[l.id] || null, ok = isUnlocked(l.index), done = rec && (rec.stars > 0 || rec.best > 0);
            return (
              <button key={l.id} type="button" disabled={!ok} className={`k2d-lv ${sel === l.index ? "sel" : ""}`} style={{ "--ac": accent, height: 104 }} onClick={() => { setSel(l.index); if (sel === l.index) onPlay(l.index); else sfx.tick(); }} onDoubleClick={() => ok && onPlay(l.index)}>
                {ok ? (
                  <>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 28, lineHeight: 1, color: done ? "#fff" : accent }}>{l.label || l.li + 1}</div>
                    <div style={{ fontSize: 11.5, color: C.dim, margin: "5px 2px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                    <Stars got={rec ? rec.stars : 0} size={18} />
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 4 }}>{rec && rec.best ? rec.best.toLocaleString() : "—"}</div>
                  </>
                ) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}><Lock /><div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 18, color: C.dim }}>{l.label || l.li + 1}</div></div>)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 20 }}>{cur ? `${cur.label || cur.li + 1} · ${cur.name}` : ""}</div>
            <div style={{ fontSize: 13.5, color: C.dim, marginTop: 3, lineHeight: 1.35 }}>{cur && (cur.desc || cur.world.blurb || "")}</div>
          </div>
          <Btn primary accent={accent} h={56} size={21} disabled={!isUnlocked(sel)} onClick={() => isUnlocked(sel) && onPlay(sel)} style={{ opacity: isUnlocked(sel) ? 1 : 0.45, minWidth: 200 }}>▶&nbsp; PLAY</Btn>
        </div>
      </div>
    </div>
  );
}

function HelpScreen({ def, accent, onGo, onBack, first, touch }) {
  return (
    <div className="k2d-fade" style={{ position: "absolute", inset: 0, background: "rgba(8,4,26,.8)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="k2d-card k2d-pop" style={{ width: 760, padding: "26px 30px 24px" }}>
        <div style={{ fontFamily: F.pixel, fontSize: 9, letterSpacing: 2, color: accent, marginBottom: 8 }}>HOW TO PLAY</div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, marginBottom: 6 }}>{def.title}</div>
        {def.goal && <p style={{ fontSize: 17, color: C.dim, lineHeight: 1.45, margin: "0 0 16px" }}>{def.goal}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 14, color: accent, marginBottom: 8 }}>Controls</div>
            {((touch && def.touchControls) || def.controls || []).map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14.5 }}>
                <span style={{ fontFamily: F.mono, fontSize: 12.5, color: C.text, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "3px 9px" }}>{k}</span><span style={{ color: C.dim, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 14, color: accent, marginBottom: 8 }}>Tips</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: C.dim, fontSize: 14.5, lineHeight: 1.5 }}>{(def.tips || []).map((t, i) => <li key={i} style={{ marginBottom: 6 }}>{t}</li>)}</ul>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 22 }}>
          <Btn ghost h={48} size={16} onClick={onBack}>Back</Btn>
          <Btn primary accent={accent} h={52} size={19} onClick={onGo}>{first ? "Got it, let's go" : "Start playing"} ▶</Btn>
        </div>
      </div>
    </div>
  );
}

function PauseMenu({ accent, onResume, onRestart, onLevels, onExit, def, level }) {
  return (
    <div className="k2d-fade" style={{ position: "absolute", inset: 0, background: "rgba(8,4,26,.66)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="k2d-card k2d-pop" style={{ width: 340, padding: "24px 26px 22px", textAlign: "center" }}>
        <div style={{ fontFamily: F.pixel, fontSize: 10, letterSpacing: 2, color: accent }}>PAUSED</div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 26, margin: "8px 0 4px" }}>{level ? level.name : def.title}</div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 18 }}>{def.title}{level ? ` · ${level.label || level.li + 1}` : ""}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn primary accent={accent} h={52} size={20} onClick={onResume}>▶&nbsp; Resume</Btn>
          <Btn ghost h={44} size={16} onClick={onRestart}>↻&nbsp; Restart level</Btn>
          <Btn ghost h={44} size={16} onClick={onLevels}>Level select</Btn>
        </div>
        <div style={{ fontSize: 11.5, color: C.dim, marginTop: 14, opacity: 0.8 }}>Press Esc or P to resume</div>
      </div>
    </div>
  );
}

function ResultScreen({ def, accent, r, submit, onNext, onRetry, onLevels }) {
  const won = r.won, score = useCountUp(r.score || 0, 1100), lines = r.lines || [];
  const title = r.title || (won ? "LEVEL COMPLETE" : "TRY AGAIN");
  return (
    <div className="k2d-fade" style={{ position: "absolute", inset: 0, background: "rgba(8,4,26,.62)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="k2d-card k2d-pop" style={{ width: 540, padding: "26px 32px 24px", textAlign: "center", borderColor: won ? accent : C.line }}>
        <div style={{ fontFamily: F.pixel, fontSize: 10, letterSpacing: 2, color: won ? accent : C.mag }}>{r.level ? `${r.level.world.name.toUpperCase()} · ${r.level.label || r.level.li + 1}` : ""}</div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, margin: "8px 0 2px", ...(won ? gradText(accent, "#fff") : { color: "#ffd2e6" }) }}>{title}</div>
        {r.sub && <div style={{ fontSize: 15, color: C.dim }}>{r.sub}</div>}
        {won && <div style={{ margin: "14px 0 6px" }}><Stars got={r.stars || 1} size={46} anim delay={0.15} /></div>}
        <div style={{ margin: "12px auto 4px", width: 380, textAlign: "left" }}>
          {lines.map(([k, v], i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 15.5, borderBottom: `1px dashed ${C.line}` }}><span style={{ color: C.dim }}>{k}</span><span style={{ fontFamily: F.mono, fontWeight: 600 }}>{v}</span></div>))}
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, color: C.gold, lineHeight: 1.1, marginTop: 6 }}>{score.toLocaleString()}</div>
        <div style={{ fontSize: 13.5, minHeight: 20, color: C.dim, marginTop: 2 }}>
          {r.newBest ? <span style={{ color: C.gold, fontWeight: 700 }}>★ New level best!</span> : r.bestBefore > 0 && won ? `Level best ${Math.max(r.bestBefore, r.score).toLocaleString()}` : ""}
          {submit && submit.state === "saving" && <span> · saving…</span>}
          {submit && submit.state === "done" && <span style={{ color: submit.isNewBest ? C.cyan : C.dim }}> · {submit.isNewBest ? "new game record saved" : "score saved"}{submit.xpGained ? ` · +${submit.xpGained} XP` : ""}</span>}
          {submit && submit.state === "error" && <span style={{ color: C.mag }}> · couldn't save score</span>}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <Btn ghost h={50} size={16} onClick={onLevels}>Levels</Btn>
          <Btn ghost h={50} size={16} onClick={onRetry}>↻ Retry</Btn>
          {won && r.next != null && <Btn primary accent={accent} h={54} size={19} onClick={onNext}>Next level ▶</Btn>}
          {won && r.next == null && <Btn primary accent={accent} h={54} size={18} onClick={onLevels}>All done! ★</Btn>}
        </div>
      </div>
    </div>
  );
}
