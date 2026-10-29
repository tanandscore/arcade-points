"use client";

// Wrath of Olympus — a small Age-of-Empires-style war game. You lead Athens against an AI-run Sparta:
// gather food, wood, gold and stone, build a city, climb the ages, raise an army and destroy the enemy's Town Centers.
// You also pick a champion (a main character with its own powers), follow minor gods as you grow, and explore the fog for shrines, monster dens and relics.
// The rules live in olympus/engine/sim.js; this file is the screen around it.
import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine } from "@/olympus/engine/engine";
import { DIFFICULTY, RES_ICON, AGES, POWERS, HEROES, HERO_ORDER, ABILITIES, GODS } from "@/olympus/engine/defs";
import { CAMPAIGN, missionOpen, campaignScenario, skirmishScenario, dailyScenario } from "@/olympus/engine/campaign";
import { loadMeta, saveMeta, blessingFx, buyBlessing, recordMatch, rankOf, dayKey, nextCost, BLESSINGS, emptyMeta } from "@/olympus/engine/meta";
import { Hub, CampaignScreen, SkirmishScreen, DailyScreen, PantheonScreen } from "@/olympus/WrathMenus";
import { FONT, GOLD, STONE, STONE2, EDGE, bar, chipBtn, goldBtn, fmtT } from "@/olympus/ui";
import { createGameMusic } from "@/lib/cinematic/music";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";

function Minimap({ eng }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !eng) return undefined;
    const id = setInterval(() => { try { eng.drawMinimap(c); } catch {} }, 160);
    let down = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
    const md = (e) => { e.preventDefault(); const [x, y] = pos(e); eng.minimapClick(x, y, c.width, e.button === 2); down = e.button === 0; };
    const mm = (e) => { if (down) { const [x, y] = pos(e); eng.minimapClick(x, y, c.width, false); } };
    const mu = () => { down = false; };
    c.addEventListener("pointerdown", md); window.addEventListener("pointermove", mm); window.addEventListener("pointerup", mu); c.addEventListener("contextmenu", (e) => e.preventDefault());
    return () => { clearInterval(id); c.removeEventListener("pointerdown", md); window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu); };
  }, [eng]);
  return <canvas ref={ref} width={230} height={230} style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }} data-testid="minimap" />;
}

const STATUS_TEXT = { rage: "😡 Raging", fury: "🔥 Fury", swift: "💨 Swift", warcry: "📯 War cry", swiftfoot: "💨 Swift foot", sandals: "🪽 Winged", stun: "💫 Stunned" };

function HpBar({ hp, max, w = "100%" }) {
  const f = Math.max(0, Math.min(1, hp / max));
  return <div style={{ width: w, height: 9, background: "#150f08", border: "1px solid #000", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${f * 100}%`, height: "100%", background: f > 0.6 ? "#59d04a" : f > 0.3 ? "#e9c43a" : "#e0452e" }} /></div>;
}

function Info({ st, eng }) {
  const s = st.sel;
  if (!s) return <div style={{ color: "#c9b88f", fontSize: 12, lineHeight: 1.5, padding: 10 }}>
    <b style={{ color: GOLD }}>Nothing selected</b><br />Click a citizen or building. Drag a box to select a crowd. Right-click to give orders.<br />
    <span style={{ opacity: 0.8 }}>Idle citizens: <b>.</b> &nbsp; Home: <b>H</b> &nbsp; Army: <b>,</b></span>
  </div>;
  if (s.group) return <div style={{ padding: 8 }}>
    <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{s.total} selected</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{s.group.map((g) => <button key={g.kind} onClick={() => eng.setSel(g.ids)} title={g.name} style={{ ...chipBtn, padding: "4px 8px", display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 20 }}>{g.icon}</span><b>×{g.n}</b></button>)}</div>
    <div style={{ color: "#c9b88f", fontSize: 11, marginTop: 8 }}>Right-click ground to move, an enemy to attack, a tree or mine to gather.</div>
  </div>;
  const d = s.single;
  return <div style={{ display: "flex", gap: 10, padding: 8, height: "100%", boxSizing: "border-box" }}>
    <div style={{ width: 64, flex: "none", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 8, background: d.owner === 1 ? "#5a1f1a" : d.owner === 0 ? "#1d3560" : d.owner === 2 ? "#4a3d12" : "#3a3a2a", border: `2px solid ${EDGE}`, display: "grid", placeItems: "center", fontSize: 34 }}>{d.icon}</div>
      {d.type !== "node" && <div style={{ marginTop: 5 }}><HpBar hp={d.hp} max={d.maxHp} /><div style={{ fontSize: 10, color: "#d9c9a0", marginTop: 2 }}>{d.hp}/{d.maxHp}</div></div>}
    </div>
    <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ color: GOLD, fontWeight: 800, fontSize: 14 }}>{d.name}{d.owner === 1 ? <span style={{ color: "#ff8a7a", fontWeight: 600 }}> · Sparta</span> : d.owner === 2 ? <span style={{ color: "#e6c34a", fontWeight: 600 }}> · Wild</span> : null}{d.hero ? <span style={{ color: "#ffe58a", fontWeight: 600 }}> · Level {d.level}</span> : null}</div>
      {d.type === "unit" && <div style={{ color: "#e7dbbb" }}>⚔️ {d.atk > 0 ? d.atk : "—"} &nbsp; 🛡️ {d.mArm}/{d.pArm} &nbsp; {d.range > 2 ? `🎯 ${d.range}` : ""} {d.owner === 0 && <span style={{ color: "#9fd8ff" }}> · {d.state}{d.carry ? ` (${d.carry})` : ""}</span>}</div>}
      {d.statuses && d.statuses.length > 0 && <div style={{ color: "#ffd27a", fontSize: 11 }}>{d.statuses.map((k) => STATUS_TEXT[k] || k).join(" · ")}</div>}
      {d.type === "building" && !d.done && <div style={{ color: "#9fd8ff" }}>Under construction {Math.round(d.progress * 100)}%</div>}
      {d.type === "building" && d.done && d.popCap && <div style={{ color: "#e7dbbb" }}>Homes {d.popCap} people</div>}
      {d.type === "node" && <div style={{ color: "#e7dbbb" }}>{RES_ICON[d.res]} {d.left} left</div>}
      <div style={{ color: "#bfae86", fontSize: 11 }}>{d.desc}</div>
      {d.type === "building" && d.owner === 0 && d.queue && d.queue.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
        {d.queue.map((q, i) => <button key={i} title={`${q.label} — click to cancel`} onClick={() => eng.cancelQueue(d.id, i)} style={{ ...chipBtn, padding: 2, width: 40, height: 40, position: "relative", overflow: "hidden", fontSize: 20 }}>
          {q.icon}{i === 0 && <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${Math.min(100, q.pct * 100)}%`, background: "#59d04a" }} />}
        </button>)}
      </div>}
      {d.type === "building" && d.owner === 0 && d.done && d.rally && <div style={{ color: "#8fc4ff", fontSize: 10, marginTop: 3 }}>Rally flag set (right-click to move it)</div>}
    </div>
  </div>;
}

function Bar({ f, color, h = 7 }) { return <div style={{ height: h, background: "#150f08", border: "1px solid #000", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, height: "100%", background: color }} /></div>; }

// your champion: portrait, level, health, experience and the two special abilities
function HeroPanel({ st, eng, setTip }) {
  const h = st.hero; if (!h) return null; const def = HEROES[h.id];
  return <div style={{ width: 236, flex: "none", margin: "6px 0 6px 6px", padding: 7, boxSizing: "border-box", background: "linear-gradient(#2a2118,#1a140d)", border: `1px solid ${h.selected ? "#ffe58a" : EDGE}`, borderRadius: 4, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }} data-testid="hero-panel">
    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
      <button onClick={() => eng.selectHero()} title="Select your champion (Tab)" style={{ ...chipBtn, width: 46, height: 46, padding: 0, fontSize: 26, flex: "none", borderColor: def.color, background: `linear-gradient(#4a3a27,${def.color}55)` }}>{h.icon}</button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: def.color, fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name} <span style={{ color: "#ffe58a", fontWeight: 700 }}>Lv {h.level}</span></div>
        {h.state === "alive" ? <><Bar f={h.hp / h.maxHp} color={h.hp / h.maxHp > 0.6 ? "#59d04a" : h.hp / h.maxHp > 0.3 ? "#e9c43a" : "#e0452e"} /><div style={{ height: 3 }} /><Bar f={h.xpNext ? h.xp / h.xpNext : 1} color="#7aa8ff" h={5} /></> : <div style={{ color: "#ff9a8a", fontSize: 11, fontWeight: 700 }}>{h.state === "reviving" ? "Returning…" : "Fallen"}</div>}
      </div>
    </div>
    {h.state === "dead" && <button onClick={() => eng.reviveHero()} style={{ ...chipBtn, padding: "6px", opacity: h.canRevive ? 1 : 0.5, color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)" }} data-testid="revive">Bring back · {h.reviveCost}</button>}
    {h.state === "alive" && <div style={{ display: "flex", gap: 5 }}>
      {h.abilities.map((a) => <button key={a.key} onClick={() => eng.beginAbility(a.slot)} onMouseEnter={() => setTip({ name: a.name, key: a.slot ? "⇧W" : "⇧Q", cost: `Recharge ${ABILITIES[a.key].cd}s`, desc: a.desc, enabled: a.ready, reason: a.locked ? `Unlocks at level ${a.unlockLevel}` : a.cd > 0 ? `Recharging (${Math.ceil(a.cd)}s)` : null })} onMouseLeave={() => setTip(null)}
        style={{ ...chipBtn, flex: 1, height: 44, padding: 0, position: "relative", fontSize: 22, overflow: "hidden", opacity: a.locked ? 0.4 : 1, borderColor: a.active ? "#fff" : a.ready ? "#ffe58a" : EDGE }} data-ability={a.slot}>
        {a.locked ? "🔒" : a.icon}
        {!a.locked && a.cd > 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${(a.cd / a.cdTotal) * 100}%`, background: "rgba(0,0,0,.65)" }} />}
        {!a.locked && a.cd > 0 && <span style={{ position: "absolute", right: 3, top: 1, fontSize: 10, color: "#fff" }}>{Math.ceil(a.cd)}</span>}
        <span style={{ position: "absolute", left: 3, top: 1, fontSize: 9, color: GOLD, fontWeight: 800 }}>{a.slot ? "⇧W" : "⇧Q"}</span>
      </button>)}
    </div>}
    <div style={{ fontSize: 10, color: "#bfae86", lineHeight: 1.3, cursor: "help" }} onMouseEnter={() => setTip({ name: def.passive.name, key: "passive", desc: def.passive.desc, enabled: true })} onMouseLeave={() => setTip(null)}>{h.carry ? <b style={{ color: "#ffe58a" }}>Carrying {h.carry} — take it to a Temple!</b> : <><b style={{ color: "#d9c9a0" }}>★ {def.passive.name}</b> (hover)</>}</div>
  </div>;
}

function CommandCard({ st, eng, setTip }) {
  const cmds = st.cmds;
  if (!cmds.length) return <div style={{ color: "#8d7e5c", fontSize: 11, padding: 8 }}>Select a citizen to build, or a building to train.</div>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 4, padding: 5, height: "100%", boxSizing: "border-box" }}>
    {cmds.map((c) => <button key={c.id} onClick={() => (c.enabled ? eng.runCmd(c.id) : eng.say(c.reason || "Can't do that", "warn"))} onMouseEnter={() => setTip(c)} onMouseLeave={() => setTip(null)}
      style={{ ...chipBtn, padding: 0, height: "100%", minHeight: 0, opacity: c.enabled ? 1 : 0.45, position: "relative", fontSize: 22, display: "grid", placeItems: "center", background: c.danger ? "linear-gradient(#5a2a22,#341610)" : bar.background }} data-cmd={c.id}>
      {c.icon}<span style={{ position: "absolute", left: 3, top: 1, fontSize: 9, color: GOLD, fontWeight: 800 }}>{c.key}</span>
    </button>)}
  </div>;
}

const KIND_ICON = { primary: "⚑", bonus: "★", fate: "🎲", guide: "📘" };
const KIND_NAME = { primary: "Mission goal", bonus: "Bonus (stars)", fate: "Fates (laurels)", guide: "Training" };
function ObjectivePanel({ f, open, setOpen }) {
  if (!f) return null;
  const groups = ["primary", "guide", "bonus", "fate"].map((k) => [k, f.objectives.filter((o) => o.kind === k)]).filter(([, l]) => l.length);
  return <div style={{ position: "absolute", top: 44, right: 10, width: 262, zIndex: 9, fontFamily: FONT }} data-testid="objectives">
    <button onClick={() => setOpen(!open)} style={{ ...chipBtn, width: "100%", display: "flex", justifyContent: "space-between", padding: "5px 10px" }}><span>{f.name || "Goals"}</span><span>{open ? "▾" : "▸"}</span></button>
    {open && <div style={{ ...bar, borderRadius: 8, marginTop: 3, padding: "6px 9px", fontSize: 11.5, lineHeight: 1.4, maxHeight: 300, overflow: "auto" }}>
      {groups.map(([k, list]) => <div key={k} style={{ marginBottom: 5 }}>
        <div style={{ color: GOLD, fontWeight: 800, fontSize: 10, letterSpacing: 1 }}>{KIND_NAME[k].toUpperCase()}</div>
        {list.map((o) => <div key={o.id} style={{ display: "flex", gap: 5, color: o.done ? "#a8f0a0" : o.failed ? "#8a7a68" : "#f3e7c9", textDecoration: o.failed ? "line-through" : "none" }} data-obj={o.id}>
          <span>{o.done ? "✔" : o.failed ? "✖" : KIND_ICON[k]}</span><span style={{ flex: 1 }}>{o.label}</span>{o.show && !o.done && !o.failed && o.n > 1 && o.n < 5000 && o.label.indexOf("Age") < 0 && <span style={{ color: "#9fd8ff" }}>{o.cur}/{o.n}</span>}
        </div>)}
      </div>)}
    </div>}
  </div>;
}

function OmenCard({ omen, eng }) {
  if (!omen) return null;
  return <div style={{ position: "absolute", top: 118, left: "50%", transform: "translateX(-50%)", width: "min(440px, 92%)", ...bar, borderRadius: 12, padding: "12px 14px", zIndex: 25, border: "1px solid #ffd84a", boxShadow: "0 6px 26px rgba(0,0,0,.7), 0 0 22px rgba(255,216,74,.25)" }} data-testid="omen">
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 30 }}>{omen.icon}</span><div style={{ flex: 1 }}><div style={{ fontSize: 10, letterSpacing: 2, color: "#9c8f6c" }}>OMEN</div><div style={{ fontWeight: 900, color: GOLD, fontSize: 16 }}>{omen.title}</div></div><div style={{ fontWeight: 900, color: omen.left <= 10 ? "#ff8a7a" : "#ffe58a" }}>{omen.left}s</div></div>
    <div style={{ fontSize: 12, color: "#d6c8a2", margin: "6px 0 9px", lineHeight: 1.5 }}>{omen.text}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {omen.options.map((op, i) => <button key={i} disabled={!op.enabled} onClick={() => eng.answerOmen(i)} data-omen-choice={i} style={{ ...chipBtn, textAlign: "left", padding: "7px 10px", opacity: op.enabled ? 1 : 0.45, cursor: op.enabled ? "pointer" : "default" }}>
        <div style={{ color: GOLD, fontSize: 13 }}>{op.label}</div><div style={{ fontSize: 11, fontWeight: 500, color: "#d6c8a2" }}>{op.desc}{!op.enabled && op.reason ? <span style={{ color: "#ff9a8a" }}> · {op.reason}</span> : null}</div>
      </button>)}
    </div>
  </div>;
}

function resultLine(o, launch) {
  if (o.won) { if (o.reason === "survive") return "You held out until the relief column arrived. Athens stands!"; if (o.reason === "lairs") return "The dens are cleared and the hills are yours."; if (o.reason === "relics") return "The sacred relics are safe in your Temple."; if (o.wonder) return "Your Wonder stood for all to see. The gods crown Athens!"; return "Sparta's Town Centers lie in ruins. Athens is victorious!"; }
  if (o.reason === "time") return "Time ran out. The prophecy comes true."; return o.wonder ? "Sparta's Wonder stood unbroken. Athens bows to the gods." : "Your last Town Center has fallen. Athens is lost.";
}

const HELP = (<>
  <b style={{ color: GOLD }}>Start:</b> select your Town Center (click it) and train Citizens. Right-click a tree, berries or a mine with citizens selected to make them gather. Build Houses so you can have more people.<br />
  <b style={{ color: GOLD }}>Grow:</b> Farms give endless food. Build a Barracks for hoplites, then advance to the Classical Age at the Town Center for archers, horsemen and towers. Temples give you the gods&apos; powers.<br />
  <b style={{ color: GOLD }}>Your champion:</b> your main character starts next to your Town Center (press Tab to find them). They level up from fights and discoveries, have two special abilities (Shift+Q and Shift+W, the second unlocks at level 2) and make your whole army stronger. If they fall, bring them back from your Temple or Town Center for gold.<br />
  <b style={{ color: GOLD }}>The gods:</b> when you advance an age you choose a minor god to follow. Each one changes your army and unlocks a myth creature at your Temple. Your champion decides which three divine powers you may call down.<br />
  <b style={{ color: GOLD }}>Explore:</b> the dark mist hides Oracle shrines, monster dens guarding gold and experience, and four sacred relics. Carry a relic with your champion to your Temple to keep its power.<br />
  <b style={{ color: GOLD }}>Omens:</b> every few minutes a card appears with a choice: spend a little to gain a lot, gamble, or walk away. You have 40 seconds. Doing nothing counts as walking away.<br />
  <b style={{ color: GOLD }}>Goals and fates:</b> the panel on the right lists your mission goals (★ bonus ones earn stars) and three optional fates in every skirmish. Each fate you fulfil pays laurels.<br />
  <b style={{ color: GOLD }}>Laurels:</b> every war pays laurels. Spend them in the Pantheon on blessings that last for ever. Your rank rises as your total grows.<br />
  <b style={{ color: GOLD }}>Two ways to win:</b> destroy every enemy Town Center, or build a Wonder (Classical Age) and keep it standing for four minutes. Some missions ask for something else, such as surviving.<br />
  <b style={{ color: GOLD }}>Fight:</b> drag a box around soldiers, then right-click an enemy to attack. Spears beat horses, horses beat archers, archers beat spears. Catapults smash buildings.<br />
  <b style={{ color: GOLD }}>Keys:</b> arrows or screen edge to scroll · mouse wheel to zoom · middle-drag to pan · Q W E R / A S D F / Z X C V = the buttons · Tab champion · Shift+Q / Shift+W champion abilities · . idle citizen · H home · , all soldiers · Space jump to attack · Ctrl or Shift + 1–9 save a group · P pause · Esc cancel.
</>);

export default function WrathOfOlympus({ onFinish, accentColor = "#ffb703" }) {
  const stage = useStage();
  const mountRef = useRef(null), engRef = useRef(null), musicRef = useRef(null), doneRef = useRef(false);
  const [phase, setPhase] = useState("menu"); // menu | play
  const [screen, setScreen] = useState("hub"); // hub | campaign | skirmish | daily | pantheon
  const [diff, setDiff] = useState("veteran");
  const [pers, setPers] = useState("balanced");
  const [heroId, setHeroId] = useState("achilles");
  const [mSel, setMSel] = useState(0);
  const [meta, setMeta] = useState(emptyMeta);
  const metaRef = useRef(meta);
  const [report, setReport] = useState(null); // what the last war paid out
  const [launch, setLaunch] = useState(null); // { mode, mission } of the war in progress
  const [objOpen, setObjOpen] = useState(true);
  const [st, setSt] = useState(null);
  const [eng, setEng] = useState(null);
  const [tip, setTip] = useState(null);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [fail, setFail] = useState(false);
  const [musicOn, setMusicOn] = useState(true);

  const stopAll = useCallback(() => {
    try { engRef.current && engRef.current.dispose(); } catch {} engRef.current = null; setEng(null);
    try { musicRef.current && musicRef.current.stop(); } catch {} musicRef.current = null;
  }, []);
  useEffect(() => () => stopAll(), [stopAll]);
  useEffect(() => { const m = loadMeta(); metaRef.current = m; setMeta(m); const first = CAMPAIGN.findIndex((c, i) => missionOpen(m, i) && !((m.campaign[c.id] || {}).stars)); if (first >= 0) setMSel(first); }, []);
  const commitMeta = useCallback((m) => { metaRef.current = m; setMeta(m); saveMeta(m); }, []);

  function begin(mode = "skirmish") {
    stopAll(); doneRef.current = false; setMenu(false); setSt(null); setReport(null);
    let scn, hero = heroId, difficulty = diff;
    if (mode === "campaign") { const m = CAMPAIGN[mSel]; scn = campaignScenario(m, heroId); difficulty = m.difficulty; }
    else if (mode === "daily") { scn = dailyScenario(dayKey(), DIFFICULTY, HERO_ORDER); hero = scn.hero; difficulty = scn.difficulty; }
    else scn = skirmishScenario({ difficulty: diff, personality: pers, DIFFICULTY });
    setLaunch({ mode, mission: scn.mission || null, name: scn.name });
    try {
      const e = createEngine({ mount: mountRef.current, difficulty, hero, scenario: scn, blessings: blessingFx(metaRef.current), onState: (s) => setSt(s) });
      engRef.current = e; setEng(e); e.start();
      if (typeof window !== "undefined" && window.__OL_EXPOSE) { window.__ol = e; }
    } catch (err) { console.error(err); setFail(true); return; }
    stage.enter();
    try { musicRef.current = createGameMusic("olympus", "olympus-music"); setMusicOn(musicRef.current.isEnabled()); musicRef.current.setIntensity(0.3); musicRef.current.start(); } catch {}
    setPhase("play");
  }
  useEffect(() => { if (!st || !st.over || doneRef.current) return; doneRef.current = true; const r = st.over; try { const rec = recordMatch(metaRef.current, r); commitMeta(rec.meta); setReport({ gain: rec.gain, parts: rec.parts, rankUp: rec.rankUp, rank: rankOf(rec.meta.total), laurels: rec.meta.laurels, newStars: rec.newStars, streak: rec.streak }); } catch (err) { console.error(err); } if (musicRef.current) { try { musicRef.current.stinger(r.won ? "win" : "lose"); musicRef.current.setIntensity(0.15); } catch {} } fetch("/api/difficulty-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "wrathofolympus", difficulty: r.difficulty, score: r.score }) }).catch(() => {}); }, [st]);
  useEffect(() => { if (musicRef.current && st) musicRef.current.setIntensity(Math.min(0.8, 0.28 + (st.army || 0) * 0.01 + (st.age || 0) * 0.08)); }, [st && st.age, st && Math.floor((st.army || 0) / 5)]); // eslint-disable-line
  function toggleMusic() { const m = musicRef.current; if (!m) return; m.setEnabled(!m.isEnabled()); setMusicOn(m.isEnabled()); }
  function again(to) { stopAll(); setPhase("menu"); setSt(null); if (typeof to === "string") setScreen(to); }
  function nextMission() { const i = Math.min(CAMPAIGN.length - 1, mSel + 1); setMSel(i); stopAll(); setPhase("menu"); setSt(null); setScreen("campaign"); }
  function buy(k) { const r = buyBlessing(metaRef.current, k); if (r.ok) commitMeta(r.meta); }
  function finish() { onFinish(st && st.over ? st.over.score : 0); }

  const box = stageBoxStyle(stage.isFull, { background: "#0b0906", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT });
  const playing = phase === "play" && st;

  return (
    <div style={box} data-wrath-root>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, display: playing ? "block" : "none" }} data-testid="world" />
      {fail && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#f3e7c9", background: "#120d08", padding: 24, textAlign: "center" }}>This game needs 3D graphics (WebGL), which your browser couldn&apos;t start. Try another browser or turn on hardware acceleration.</div>}

      {phase === "menu" && !fail && <>
        {screen === "hub" && <Hub meta={meta} go={setScreen} help={help} setHelp={setHelp} helpText={HELP} />}
        {screen === "campaign" && <CampaignScreen meta={meta} sel={mSel} setSel={setMSel} heroId={heroId} setHeroId={setHeroId} begin={() => begin("campaign")} back={() => setScreen("hub")} />}
        {screen === "skirmish" && <SkirmishScreen heroId={heroId} setHeroId={setHeroId} diff={diff} setDiff={setDiff} pers={pers} setPers={setPers} accentColor={accentColor} begin={() => begin("skirmish")} back={() => setScreen("hub")} />}
        {screen === "daily" && <DailyScreen meta={meta} begin={() => begin("daily")} back={() => setScreen("hub")} />}
        {screen === "pantheon" && <PantheonScreen meta={meta} buy={buy} back={() => setScreen("hub")} />}
      </>}

      {playing && !st.over && <>
        {/* top bar */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, ...bar, borderRadius: 0, borderWidth: "0 0 1px 0", display: "flex", alignItems: "center", gap: 14, padding: "5px 12px", fontSize: 13, fontWeight: 700, zIndex: 10 }}>
          {["food", "wood", "gold", "stone"].map((r) => <div key={r} title={r} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 64 }}><span style={{ fontSize: 17 }}>{RES_ICON[r]}</span><span style={{ color: st.res[r] < 25 ? "#ff9a8a" : "#fff" }}>{Math.floor(st.res[r])}</span><span style={{ fontSize: 10, color: "#9fd8ff" }}>{st.gatherers[r] ? `🧑${st.gatherers[r]}` : ""}</span></div>)}
          <div title="People / homes" style={{ color: st.pop + st.reserved >= st.popCap ? "#ff9a8a" : "#fff" }}>👥 {st.pop}/{st.popCap}</div>
          <div title="Favor of the gods" style={{ color: st.hasTemple ? "#ffe58a" : "#8d7e5c" }}>✨ {st.favor}</div>
          <div style={{ flex: 1, textAlign: "center", color: GOLD }}>🏺 {st.ageName}{st.ageBusy ? " — advancing…" : ""}</div>
          <div style={{ color: "#ff9a8a", fontSize: 11, whiteSpace: "nowrap" }} title="The enemy champion">Sparta: {st.enemyAge}{st.enemyHero ? ` · ${st.enemyHero.icon}${st.enemyHero.level}${st.enemyHero.state !== "alive" ? "✖" : ""}` : ""}</div>
          {(st.gods.length > 0 || st.relics.length > 0) && <div style={{ display: "flex", gap: 3, fontSize: 17 }}>{st.gods.map((g) => <span key={g.key} title={`Following ${g.name}`}>{g.icon}</span>)}{st.relics.map((r) => <span key={r.key} title={`${r.name}: ${r.desc}`}>{r.icon}</span>)}</div>}
          <div style={{ display: "flex", gap: 4 }}>
          {st.powers.map((p) => <button key={p.key} onClick={() => eng.beginPower(p.key)} onMouseEnter={() => setTip({ name: p.name, key: "", cost: `✨ ${p.favor} favor`, desc: p.desc, enabled: p.ready, reason: !st.hasTemple ? "Build a Temple first" : p.cd > 0 ? `Recharging (${Math.ceil(p.cd)}s)` : "Not enough favor" })} onMouseLeave={() => setTip(null)}
            style={{ ...chipBtn, padding: "2px 7px", fontSize: 17, opacity: p.ready ? 1 : 0.4, borderColor: p.ready ? "#ffe58a" : EDGE }} data-power={p.key}>{p.icon}</button>)}
          </div>
          {st.fates && st.fates.clock && <div title={st.fates.clock.label} style={{ color: st.fates.clock.good ? "#a8f0a0" : st.fates.clock.left < 120 ? "#ff8a7a" : "#ffe58a", whiteSpace: "nowrap" }} data-testid="clock">{st.fates.clock.good ? "🛡️" : "⏳"} {fmtT(st.fates.clock.left)}</div>}
          <div>{fmtT(st.t)}</div>
          <button style={chipBtn} onClick={() => eng.setSpeed(st.speed === 1 ? 2 : 1)} title="Game speed">{st.speed}×</button>
          <button style={chipBtn} onClick={toggleMusic} title="Music">{musicOn ? "🎵" : "🔇"}</button>
          <button style={chipBtn} onClick={() => { setMenu(true); eng.setPaused(true); }} data-testid="menu-btn">Menu</button>
        </div>

        {/* messages */}
        <div style={{ position: "absolute", left: 12, top: 50, display: "flex", flexDirection: "column", gap: 4, zIndex: 9, pointerEvents: "none" }}>
          {st.msgs.map((m) => <div key={m.id} style={{ ...bar, padding: "4px 10px", borderRadius: 6, fontSize: 12, color: m.kind === "alert" ? "#ff8a7a" : m.kind === "warn" ? "#ffd27a" : m.kind === "good" ? "#a8f0a0" : "#f3e7c9", border: `1px solid ${m.kind === "alert" ? "#a03a2a" : EDGE}` }}>{m.text}</div>)}
        </div>

        <ObjectivePanel f={st.fates} open={objOpen} setOpen={setObjOpen} />
        <OmenCard omen={st.fates && st.fates.omen} eng={eng} />
        {/* wonder countdowns */}
        {(st.wonderMe > 0 || st.wonderEn > 0) && <div style={{ position: "absolute", top: 82, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 9, pointerEvents: "none" }}>
          {st.wonderMe > 0 && <div style={{ ...bar, padding: "5px 14px", borderRadius: 8, color: "#ffe58a", fontWeight: 800 }}>🏛️ Your Wonder: {fmtT(st.wonderMe)} to victory</div>}
          {st.wonderEn > 0 && <div style={{ ...bar, padding: "5px 14px", borderRadius: 8, color: "#ff8a7a", fontWeight: 800, border: "1px solid #a03a2a" }}>🏛️ Enemy Wonder: {fmtT(st.wonderEn)} — destroy it!</div>}
        </div>}
        {/* mode banner */}
        {(st.placing || st.targeting || st.targetingAbility) && <div style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", ...bar, padding: "6px 16px", borderRadius: 8, fontSize: 13, zIndex: 9, pointerEvents: "none", color: GOLD }}>{st.placing ? "Click to place · hold Shift to place more · right-click or Esc to cancel" : st.targetingAbility ? `${ABILITIES[st.targetingAbility].name}: click a spot (red ring = too far) · Esc to cancel` : `${POWERS[st.targeting].name}: click the map · Esc to cancel`}</div>}

        {/* bottom panel */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "27%", minHeight: 150, maxHeight: 230, display: "flex", gap: 0, background: `linear-gradient(#3b2e20,${STONE})`, borderTop: `3px solid ${EDGE}`, boxShadow: "0 -4px 16px rgba(0,0,0,.6)", zIndex: 10, color: "#f3e7c9", fontFamily: FONT }}>
          <div style={{ height: "100%", aspectRatio: "1 / 1", flex: "none", padding: 6, boxSizing: "border-box", position: "relative" }}>
            <div style={{ width: "100%", height: "100%", background: "#000", border: `2px solid ${EDGE}`, borderRadius: 4, overflow: "hidden" }}><Minimap eng={eng} /></div>
            <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", flexDirection: "column", gap: 3 }}>
              <button style={{ ...chipBtn, padding: "3px 6px", fontSize: 11, opacity: st.idle ? 1 : 0.55 }} onClick={() => eng.selectIdle()} title="Idle citizens (.)">🧑‍🌾 {st.idle}</button>
              <button style={{ ...chipBtn, padding: "3px 6px", fontSize: 11, opacity: st.army ? 1 : 0.55 }} onClick={() => eng.selectArmy()} title="All soldiers (,)">⚔️ {st.army}</button>
            </div>
          </div>
          <HeroPanel st={st} eng={eng} setTip={setTip} />
          <div style={{ flex: 1, minWidth: 0, margin: "6px 0", background: "linear-gradient(#2a2118,#1a140d)", border: `1px solid ${EDGE}`, borderRadius: 4, overflow: "auto" }}><Info st={st} eng={eng} /></div>
          <div style={{ width: "min(34%, 330px)", flex: "none", padding: "6px", boxSizing: "border-box", position: "relative", height: "100%" }}>
            {tip && <div style={{ position: "absolute", right: 6, bottom: "100%", width: 260, ...bar, padding: 9, borderRadius: 8, fontSize: 12, lineHeight: 1.45, zIndex: 20, marginBottom: 4 }}>
              <div style={{ fontWeight: 800, color: GOLD }}>{tip.name} <span style={{ color: "#9c8f6c", fontWeight: 600 }}>({tip.key})</span></div>
              {tip.cost && <div>{tip.cost}</div>}<div style={{ color: "#d6c8a2" }}>{tip.desc}</div>{!tip.enabled && tip.reason && <div style={{ color: "#ff9a8a", marginTop: 3 }}>⚠ {tip.reason}</div>}
            </div>}
            <div style={{ background: "linear-gradient(#2a2118,#1a140d)", border: `1px solid ${EDGE}`, borderRadius: 4, height: "100%" }}><CommandCard st={st} eng={eng} setTip={setTip} /></div>
          </div>
        </div>

        {st.godChoice && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", zIndex: 35, padding: 12 }} data-testid="god-choice">
          <div style={{ ...bar, padding: 18, borderRadius: 14, maxWidth: 560, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: GOLD }}>Choose a god to follow</div>
            <div style={{ fontSize: 12, color: "#d6c8a2", margin: "4px 0 12px" }}>Entering the {AGES[st.godChoice.age].name}. Your choice lasts the whole war.</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {st.godChoice.options.map((g) => <button key={g.key} onClick={() => eng.chooseGod(g.key)} data-god={g.key} style={{ ...bar, width: 240, padding: 12, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 34 }}>{g.icon}</div><div style={{ fontWeight: 900, color: GOLD, fontSize: 16 }}>{g.name}</div><div style={{ fontSize: 11, color: "#bfae86", marginBottom: 6 }}>{g.title}</div><div style={{ fontSize: 12, lineHeight: 1.45 }}>{g.desc}</div>
              </button>)}
            </div>
            <button style={{ ...chipBtn, marginTop: 12 }} onClick={() => eng.cancelGod()}>Not yet</button>
          </div>
        </div>}

        {(menu || st.paused) && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 30 }}>
          <div style={{ ...bar, padding: 20, borderRadius: 12, display: "flex", flexDirection: "column", gap: 9, minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: GOLD }}>Paused</div>
            <button style={{ ...chipBtn, padding: 10 }} onClick={() => { setMenu(false); eng.setPaused(false); }}>Resume</button>
            <button style={{ ...chipBtn, padding: 10 }} onClick={() => setHelp((h) => !h)}>Controls</button>
            {help && <div style={{ fontSize: 11.5, lineHeight: 1.55, textAlign: "left", color: "#d6c8a2" }}>Arrows / screen edge: scroll · Wheel: zoom · Middle-drag: pan · Left-click: select · Drag: box select · Right-click: move / attack / gather / rally · Q W E R A S D F Z X C V: buttons · . idle citizen · H home · , soldiers · Space: last attack · Ctrl/Shift+1–9 save group, 1–9 recall · P pause · Esc cancel</div>}
            <button style={{ ...chipBtn, padding: 10, color: "#ff9a8a" }} onClick={() => { setMenu(false); eng.setPaused(false); eng.surrender(); }}>Surrender</button>
          </div>
        </div>}
      </>}

      {playing && st.over && <div style={{ position: "absolute", inset: 0, background: "rgba(5,3,1,.78)", display: "grid", placeItems: "center", zIndex: 40, padding: 12, overflow: "auto" }} data-testid="result">
        <div style={{ ...bar, padding: "20px 26px", borderRadius: 14, textAlign: "center", width: "min(760px, 96%)", boxSizing: "border-box" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#9c8f6c" }}>{(st.over.scenarioName || "").toUpperCase()}{st.over.twist ? "" : ""}</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: st.over.won ? "#ffe58a" : "#ff8a7a", letterSpacing: 2 }}>{st.over.won ? "VICTORY" : "DEFEAT"}</div>
          {st.over.mode === "campaign" && <div style={{ margin: "2px 0 4px", fontSize: 30, letterSpacing: 4 }} data-testid="stars">{[1, 2, 3].map((i) => <span key={i} style={{ color: i <= (st.over.stars || 0) ? "#ffd84a" : "#4a3d28" }}>★</span>)}</div>}
          <div style={{ color: "#d6c8a2", fontSize: 13, margin: "4px 0 12px" }}>{resultLine(st.over, launch)}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", textAlign: "left" }}>
            <div style={{ flex: "1 1 250px", maxWidth: 300 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 16px", fontSize: 12.5 }}>
                <span>Time</span><b>{fmtT(st.over.time)}</b><span>Enemies defeated</span><b>{st.over.stats.kills}</b><span>Your people lost</span><b>{st.over.stats.lost}</b><span>Buildings destroyed</span><b>{st.over.stats.razed}</b><span>Resources gathered</span><b>{Math.round(st.over.stats.gathered)}</b><span>Champion</span><b>{HEROES[st.over.hero].name} · Lv {st.over.heroLevel}</b><span>Monsters slain</span><b>{st.over.stats.monsters || 0}</b><span>Dens cleared</span><b>{st.over.stats.lairs || 0}</b><span>Shrines · Relics</span><b>{st.over.stats.shrines || 0} · {st.over.stats.relics || 0}</b>
              </div>
              <div style={{ fontSize: 12, color: "#9c8f6c", marginTop: 8 }}>Score ({DIFFICULTY[st.over.difficulty].name})</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: GOLD }}>{st.over.score}</div>
            </div>
            <div style={{ flex: "1 1 270px", maxWidth: 340 }}>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: 11, letterSpacing: 2, marginBottom: 3 }}>GOALS</div>
              {(st.over.objectives || []).filter((o) => o.kind !== "guide").map((o) => <div key={o.id} style={{ fontSize: 12, display: "flex", gap: 6, color: o.done ? "#a8f0a0" : "#8a7a68" }}><span>{o.done ? "✔" : "✖"}</span><span style={{ flex: 1 }}>{o.kind === "bonus" ? "★ " : o.kind === "fate" ? "🎲 " : ""}{o.label}</span></div>)}
              {report && <div style={{ marginTop: 10, background: "#1a140d", border: `1px solid ${EDGE}`, borderRadius: 8, padding: "8px 10px" }} data-testid="laurel-report">
                <div style={{ color: GOLD, fontWeight: 800, fontSize: 11, letterSpacing: 2 }}>LAURELS EARNED</div>
                {report.parts.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{p.label}</span><b style={{ color: "#ffe58a" }}>+{p.n}</b></div>)}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #3b2e20", marginTop: 4, paddingTop: 3, fontWeight: 900 }}><span>🏆 Total</span><span style={{ color: "#ffd84a" }}>+{report.gain}</span></div>
                <div style={{ fontSize: 11, color: "#bfae86", marginTop: 4 }}>{report.rank.icon} {report.rank.name}{report.rank.next ? ` · ${report.rank.next.at - metaRef.current.total} to ${report.rank.next.name}` : ""}</div>
                {report.rankUp && <div style={{ color: "#ffd84a", fontWeight: 900, fontSize: 13, marginTop: 3 }} data-testid="rank-up">RANK UP: {report.rankUp.icon} {report.rankUp.name}!</div>}
                {st.over.mode === "daily" && report.streak > 0 && st.over.won && <div style={{ fontSize: 11.5, color: "#ffb870", marginTop: 3 }}>🔥 Daily streak: {report.streak}</div>}
              </div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            {launch && launch.mode === "campaign" && st.over.won && mSel < CAMPAIGN.length - 1 && <button style={{ ...chipBtn, padding: "10px 18px", color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)" }} onClick={nextMission} data-testid="next-mission">Next mission →</button>}
            {report && Object.keys(BLESSINGS).some((k) => { const c = nextCost(metaRef.current, k); return c != null && metaRef.current.laurels >= c; }) && <button style={{ ...chipBtn, padding: "10px 18px" }} onClick={() => again("pantheon")} data-testid="to-pantheon">🔱 Spend laurels</button>}
            <button style={{ ...chipBtn, padding: "10px 18px" }} onClick={() => again(launch ? (launch.mode === "campaign" ? "campaign" : launch.mode) : "hub")} data-testid="again">{launch && launch.mode === "campaign" ? "Mission list" : "Play again"}</button>
            <button style={{ ...chipBtn, padding: "10px 18px" }} onClick={() => again("hub")}>Main menu</button>
            <button style={{ ...chipBtn, padding: "10px 18px", color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)" }} onClick={finish} data-testid="finish">Finish</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
