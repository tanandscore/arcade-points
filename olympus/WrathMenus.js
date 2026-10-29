"use client";

// Wrath of Olympus — the menu screens (Upgrade 69): hub, campaign, skirmish, daily trial and the Pantheon (permanent blessings).
import { DIFFICULTY, HEROES, HERO_ORDER, ABILITIES, POWERS } from "./engine/defs";
import { CAMPAIGN, missionOpen, PERSONALITIES, PERSONALITY_ORDER, dailyScenario, objText } from "./engine/campaign";
import { BLESSINGS, BLESSING_ORDER, rankOf, RANKS, nextCost, dailyDone, liveStreak, dayKey } from "./engine/meta";
import { FONT, GOLD, EDGE, bar, chipBtn, goldBtn, MENU_BG } from "./ui";

const shell = { position: "absolute", inset: 0, background: MENU_BG, display: "flex", flexDirection: "column", alignItems: "center", color: "#f3e7c9", padding: "18px 16px", overflow: "auto", fontFamily: FONT, boxSizing: "border-box" };
const Stars = ({ n, max = 3, size = 16 }) => <span style={{ letterSpacing: 1, fontSize: size }}>{Array.from({ length: max }, (_, i) => <span key={i} style={{ color: i < n ? "#ffd84a" : "#4a3d28" }}>★</span>)}</span>;

export function RankCard({ meta }) {
  const r = rankOf(meta.total);
  return <div style={{ ...bar, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, minWidth: 280 }} data-testid="rank-card">
    <span style={{ fontSize: 30 }}>{r.icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 900, color: GOLD, fontSize: 15 }}>{r.name}</div>
      <div style={{ height: 6, background: "#150f08", border: "1px solid #000", borderRadius: 3, overflow: "hidden", margin: "3px 0" }}><div style={{ width: `${r.pct * 100}%`, height: "100%", background: "linear-gradient(#f4d27a,#c4912f)" }} /></div>
      <div style={{ fontSize: 10.5, color: "#bfae86" }}>{r.next ? `${meta.total} / ${r.next.at} laurels to ${r.next.name}` : "Highest rank reached"}</div>
    </div>
    <div style={{ textAlign: "center" }}><div style={{ fontSize: 22 }}>🏆</div><div style={{ fontWeight: 900, color: "#ffe58a" }} data-testid="laurels">{meta.laurels}</div></div>
  </div>;
}

export function BackBar({ title, onBack, right }) {
  return <div style={{ width: "100%", maxWidth: 1040, display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
    <button onClick={onBack} style={{ ...chipBtn, padding: "7px 14px", fontSize: 13 }} data-testid="back">← Back</button>
    <h2 style={{ margin: 0, flex: 1, color: GOLD, letterSpacing: 2, fontSize: "clamp(16px,2.2vw,24px)" }}>{title}</h2>{right}
  </div>;
}

export function HeroPicker({ heroId, setHeroId, locked = false }) {
  return <>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 10, maxWidth: 1000 }} data-testid="hero-picker">
      {HERO_ORDER.map((k) => { const hd = HEROES[k]; return <button key={k} disabled={locked && heroId !== k} onClick={() => setHeroId(k)} data-hero={k} style={{ ...bar, width: 188, padding: "10px 11px", borderRadius: 10, cursor: locked ? "default" : "pointer", textAlign: "left", outline: heroId === k ? `3px solid ${hd.color}` : "none", opacity: heroId === k ? 1 : locked ? 0.35 : 0.78, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 28 }}>{hd.icon}</span><div><div style={{ fontWeight: 900, color: hd.color, fontSize: 15 }}>{hd.name}</div><div style={{ fontSize: 10, color: "#d6c8a2" }}>{hd.role}</div></div></div>
        <div style={{ fontSize: 10.5, color: "#d6c8a2", lineHeight: 1.35, minHeight: 56 }}>{hd.blurb}</div>
        {[["fight", "Fighting"], ["range", "Range"], ["speed", "Speed"], ["economy", "Economy"], ["scouting", "Scouting"]].map(([rk, rn]) => <div key={rk} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, color: "#9c8f6c" }}><span style={{ width: 48 }}>{rn}</span><div style={{ flex: 1, display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i <= hd.rating[rk] ? hd.color : "#2b2216" }} />)}</div></div>)}
      </button>; })}
    </div>
    {heroId && <div style={{ ...bar, maxWidth: 640, padding: "8px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
      <b style={{ color: HEROES[heroId].color }}>{HEROES[heroId].name}</b> · {HEROES[heroId].passive.name}: {HEROES[heroId].passive.desc}<br />
      <span style={{ color: "#bfae86" }}>Abilities: {HEROES[heroId].abilities.map((a) => `${ABILITIES[a].icon} ${ABILITIES[a].name}`).join("  ·  ")}  ·  Gods' powers: {HEROES[heroId].powers.map((p) => `${POWERS[p].icon} ${POWERS[p].name}`).join("  ·  ")}</span>
    </div>}
  </>;
}

// ---- hub --------------------------------------------------------------------------------------------------------------
export function Hub({ meta, go, help, setHelp, helpText }) {
  const done = dailyDone(meta); const streak = liveStreak(meta); const stars = CAMPAIGN.reduce((n, m) => n + ((meta.campaign[m.id] || {}).stars || 0), 0);
  const nextM = CAMPAIGN.find((m, i) => missionOpen(meta, i) && !((meta.campaign[m.id] || {}).stars));
  const card = (id, icon, title, text, foot, hot) => <button key={id} onClick={() => go(id)} data-menu={id} style={{ ...bar, width: 222, padding: "14px 14px 12px", borderRadius: 14, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 6, outline: hot ? "2px solid #ffd84a" : "none" }}>
    <div style={{ fontSize: 34 }}>{icon}</div><div style={{ fontWeight: 900, color: GOLD, fontSize: 18, letterSpacing: 1 }}>{title}</div><div style={{ fontSize: 12, color: "#d6c8a2", lineHeight: 1.45, minHeight: 48 }}>{text}</div><div style={{ fontSize: 11, color: hot ? "#ffd84a" : "#9c8f6c", fontWeight: 700 }}>{foot}</div>
  </button>;
  return <div style={shell}>
    <div style={{ fontSize: "clamp(11px,1.4vw,14px)", letterSpacing: 6, color: "#c9a44a" }}>⚡ A GAME OF EMPIRES ⚡</div>
    <h1 style={{ margin: "4px 0 2px", fontSize: "clamp(28px,5vw,56px)", color: GOLD, textShadow: "0 3px 0 #5a3d12, 0 0 28px rgba(255,200,90,.35)", letterSpacing: 2, textAlign: "center" }}>WRATH OF OLYMPUS</h1>
    <p style={{ maxWidth: 620, textAlign: "center", fontSize: "clamp(12px,1.35vw,15px)", lineHeight: 1.55, color: "#e1d3ae", margin: "6px 0 14px" }}>Lead Athens with a champion at your side. Grow through three ages, follow the gods, scout the mist for relics and monsters, answer the omens, and destroy Sparta.</p>
    <RankCard meta={meta} />
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", margin: "12px 0" }}>
      {card("campaign", "🏛️", "Campaign", "Eight labours across Greece. Earn up to three stars on every one.", nextM ? `Next: ${nextM.name} · ${stars}/${CAMPAIGN.length * 3} ★` : `${stars}/${CAMPAIGN.length * 3} ★ · all conquered`, !!nextM && stars === 0)}
      {card("daily", "📅", "Daily Trial", "One war, one twist, the same for everybody today. Build a streak.", done ? `Won today ✓ · streak ${streak}` : streak ? `Streak ${streak} — play to keep it!` : "New every day", !done)}
      {card("skirmish", "⚔️", "Skirmish", "Pick your champion, the difficulty and the kind of general you face.", "Three fates to fulfil each war", false)}
      {card("pantheon", "🔱", "Pantheon", "Spend laurels on permanent blessings for every future war.", `${meta.laurels} laurels to spend`, meta.laurels >= 30)}
    </div>
    <button onClick={() => setHelp((h) => !h)} style={{ ...chipBtn }}>{help ? "Hide" : "How to play"}</button>
    {help && <div style={{ ...bar, maxWidth: 680, marginTop: 10, padding: 14, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>{helpText}</div>}
  </div>;
}

// ---- campaign ---------------------------------------------------------------------------------------------------------
export function CampaignScreen({ meta, sel, setSel, heroId, setHeroId, begin, back }) {
  const m = CAMPAIGN[sel]; const rec = meta.campaign[m.id] || {}; const d = DIFFICULTY[m.difficulty];
  return <div style={shell}>
    <BackBar title="THE LABOURS OF ATHENS" onBack={back} right={<RankCard meta={meta} />} />
    <div style={{ width: "100%", maxWidth: 1040, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 300, flex: "none" }} data-testid="mission-list">
        {CAMPAIGN.map((c, i) => { const open = missionOpen(meta, i); const r = meta.campaign[c.id] || {}; return <button key={c.id} disabled={!open} onClick={() => setSel(i)} data-mission={c.id} style={{ ...bar, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, cursor: open ? "pointer" : "default", opacity: open ? 1 : 0.45, outline: sel === i ? `3px solid ${GOLD}` : "none", textAlign: "left" }}>
          <span style={{ fontSize: 26 }}>{open ? c.icon : "🔒"}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#9c8f6c", letterSpacing: 1 }}>MISSION {c.num}</div><div style={{ fontWeight: 800, color: GOLD, fontSize: 14 }}>{c.name}</div></div>
          <Stars n={r.stars || 0} size={15} />
        </button>; })}
      </div>
      <div style={{ ...bar, borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 320, maxWidth: 720 }} data-testid="briefing">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 40 }}>{m.icon}</span><div><div style={{ fontSize: 10, color: "#9c8f6c", letterSpacing: 2 }}>MISSION {m.num} · {d.name.toUpperCase()}</div><div style={{ fontWeight: 900, color: GOLD, fontSize: 22 }}>{m.name}</div></div><div style={{ marginLeft: "auto" }}><Stars n={rec.stars || 0} size={22} /></div></div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#e1d3ae", margin: "10px 0" }}>{m.intro}</p>
        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          <div><b style={{ color: "#ffd84a" }}>★ Victory:</b> {objText(m.primary)}{m.timeLimit ? ` within ${Math.round(m.timeLimit / 60)} minutes` : ""}</div>
          {m.bonus.map((b) => <div key={b.id}><b style={{ color: "#ffd84a" }}>★ Bonus:</b> {objText(b)}</div>)}
          {m.tips && <div style={{ color: "#bfae86", marginTop: 6 }}>{m.tips.join(" · ")}</div>}
        </div>
        <div style={{ marginTop: 14, textAlign: "center", color: GOLD, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>YOUR CHAMPION</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", margin: "8px 0 4px" }}>
          {HERO_ORDER.map((k) => <button key={k} onClick={() => setHeroId(k)} data-hero={k} title={`${HEROES[k].name}: ${HEROES[k].passive.desc}`} style={{ ...chipBtn, padding: "6px 10px", fontSize: 13, outline: heroId === k ? `3px solid ${HEROES[k].color}` : "none", opacity: heroId === k ? 1 : 0.7 }}>{HEROES[k].icon} {HEROES[k].name}</button>)}
        </div>
        <div style={{ fontSize: 11, color: "#bfae86", textAlign: "center", marginBottom: 12 }}>{HEROES[heroId].passive.name}: {HEROES[heroId].passive.desc}</div>
        <div style={{ textAlign: "center" }}><button onClick={begin} data-testid="start" style={goldBtn}>BEGIN MISSION</button></div>
      </div>
    </div>
  </div>;
}

// ---- skirmish -----------------------------------------------------------------------------------------------------------
export function SkirmishScreen({ heroId, setHeroId, diff, setDiff, pers, setPers, accentColor, begin, back }) {
  return <div style={shell}>
    <BackBar title="SKIRMISH" onBack={back} />
    <div style={{ color: GOLD, fontWeight: 800, letterSpacing: 2, fontSize: 12, marginBottom: 6 }}>CHOOSE YOUR CHAMPION</div>
    <HeroPicker heroId={heroId} setHeroId={setHeroId} />
    <div style={{ color: GOLD, fontWeight: 800, letterSpacing: 2, fontSize: 12, marginBottom: 6 }}>DIFFICULTY</div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
      {Object.entries(DIFFICULTY).map(([k, d]) => <button key={k} onClick={() => setDiff(k)} data-diff={k} style={{ ...bar, width: 190, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left", outline: diff === k ? `3px solid ${accentColor}` : "none", opacity: diff === k ? 1 : 0.8 }}>
        <div style={{ fontWeight: 800, color: GOLD, fontSize: 15 }}>{d.name}</div><div style={{ fontSize: 11, color: "#d6c8a2", marginTop: 3, lineHeight: 1.4 }}>{d.desc}</div><div style={{ fontSize: 10, color: "#9c8f6c", marginTop: 5 }}>Score ×{d.scoreMult}</div>
      </button>)}
    </div>
    <div style={{ color: GOLD, fontWeight: 800, letterSpacing: 2, fontSize: 12, marginBottom: 6 }}>YOUR ENEMY GENERAL</div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
      {PERSONALITY_ORDER.map((k) => { const p = PERSONALITIES[k]; return <button key={k} onClick={() => setPers(k)} data-pers={k} style={{ ...bar, width: 190, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left", outline: pers === k ? `3px solid ${accentColor}` : "none", opacity: pers === k ? 1 : 0.8 }}>
        <div style={{ fontWeight: 800, color: GOLD, fontSize: 14 }}>{p.icon} {p.name}</div><div style={{ fontSize: 11, color: "#d6c8a2", marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>{p.scoreMult !== 1 && <div style={{ fontSize: 10, color: "#9c8f6c", marginTop: 5 }}>Score ×{p.scoreMult}</div>}
      </button>; })}
    </div>
    <button onClick={begin} data-testid="start" style={goldBtn}>BEGIN THE WAR</button>
  </div>;
}

// ---- daily trial ----------------------------------------------------------------------------------------------------------
export function DailyScreen({ meta, begin, back }) {
  const key = dayKey(); const s = dailyScenario(key, DIFFICULTY, HERO_ORDER); const hd = HEROES[s.hero]; const done = dailyDone(meta); const streak = liveStreak(meta);
  return <div style={shell}>
    <BackBar title="DAILY TRIAL" onBack={back} right={<RankCard meta={meta} />} />
    <div style={{ ...bar, borderRadius: 14, padding: "18px 22px", maxWidth: 560, width: "100%", textAlign: "center" }} data-testid="daily-card">
      <div style={{ fontSize: 11, color: "#9c8f6c", letterSpacing: 3 }}>{key}</div>
      <div style={{ fontSize: 52, margin: "4px 0" }}>{s.twist.icon}</div>
      <div style={{ fontWeight: 900, color: GOLD, fontSize: 24 }}>{s.twist.name}</div>
      <div style={{ fontSize: 13.5, color: "#e1d3ae", margin: "6px 0 12px", lineHeight: 1.5 }}>{s.twist.desc}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...chipBtn, cursor: "default", color: hd.color }}>{hd.icon} {hd.name}</span><span style={{ ...chipBtn, cursor: "default" }}>{DIFFICULTY[s.difficulty].name}</span><span style={{ ...chipBtn, cursor: "default" }}>🔥 Streak {streak}</span>
      </div>
      <div style={{ fontSize: 12, color: "#bfae86", marginBottom: 14, lineHeight: 1.6 }}>Win to earn 40 laurels plus 10 for every day of your streak (up to 70). Three fates are drawn for the day.<br />{done ? <b style={{ color: "#a8f0a0" }}>You have won today&apos;s trial ✓. You can still play it for a better score.</b> : "Win today to keep your streak alive."}</div>
      <button onClick={begin} data-testid="start" style={goldBtn}>{done ? "PLAY AGAIN" : "ACCEPT THE TRIAL"}</button>
    </div>
  </div>;
}

// ---- pantheon -----------------------------------------------------------------------------------------------------------------
export function PantheonScreen({ meta, buy, back }) {
  return <div style={shell}>
    <BackBar title="THE PANTHEON" onBack={back} right={<RankCard meta={meta} />} />
    <p style={{ maxWidth: 640, textAlign: "center", fontSize: 13, color: "#e1d3ae", lineHeight: 1.6, margin: "0 0 14px" }}>Laurels are earned in every war. Spend them here on blessings that stay with you for ever and help in every future war: campaign, daily trial and skirmish alike.</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 1000 }} data-testid="blessings">
      {BLESSING_ORDER.map((k) => { const B = BLESSINGS[k]; const lvl = meta.blessings[k] || 0; const cost = nextCost(meta, k); const can = cost != null && meta.laurels >= cost;
        return <div key={k} style={{ ...bar, width: 236, padding: 13, borderRadius: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 30 }}>{B.icon}</span><div style={{ fontWeight: 900, color: GOLD, fontSize: 15 }}>{B.name}</div></div>
          <div style={{ display: "flex", gap: 3 }}>{Array.from({ length: B.max }, (_, i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: i < lvl ? "#ffd84a" : "#2b2216", border: "1px solid #000" }} />)}</div>
          <div style={{ fontSize: 11.5, color: "#d6c8a2", minHeight: 32, lineHeight: 1.4 }}>{lvl > 0 ? B.text(lvl) : "Not yet blessed."}</div>
          {cost != null && <div style={{ fontSize: 10.5, color: "#9c8f6c" }}>Next: {B.text(lvl + 1)}</div>}
          <button disabled={!can} onClick={() => buy(k)} data-bless={k} style={{ ...chipBtn, padding: "7px", opacity: can ? 1 : 0.45, color: can ? "#2a1c08" : "#f3e7c9", background: can ? "linear-gradient(#f4d27a,#c4912f)" : bar.background }}>{cost == null ? "Fully blessed" : `Bless · 🏆 ${cost}`}</button>
        </div>; })}
    </div>
    <div style={{ marginTop: 18, fontSize: 11.5, color: "#9c8f6c", textAlign: "center", lineHeight: 1.7 }}>Wars fought: {meta.matches} · Victories: {meta.wins} · Fates fulfilled: {meta.fatesDone} · Best score: {meta.bestScore}<br />Ranks: {RANKS.map((r) => `${r.icon} ${r.name} (${r.at})`).join("  →  ")}</div>
  </div>;
}
