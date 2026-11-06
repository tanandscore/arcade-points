"use client";

// Upgrade 79: the shareable moment. (1) A STORY CARD: a picture of your last chase to save or share. (2) A CLIP RECORDER: keeps the last 20-40 seconds of the
// game picture so you can save the moment you want to show people. The recorder is OFF until the player switches it on, because recording costs some speed.
import { useState, useEffect } from "react";
import { IS_TOKYO } from "@/midnightburn/engine/open/mapId";

const CUR = IS_TOKYO ? "¥" : "₹";
const num = (n) => Number(n || 0).toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN");

// ---- the story card -----------------------------------------------------------------------------------------------------------------------------------------
export function drawStoryCard(c, who = {}) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const win = c.kind !== "bust"; const accent = win ? "#6bffb0" : "#ff6b6b";
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0a0d24"); bg.addColorStop(1, win ? "#0b2a24" : "#2a0b12"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // road lines rushing to the centre
  g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 3; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(W / 2 + i * 40, H * 0.55); g.lineTo(W / 2 + i * 260, H); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(0, H * 0.55 - 2, W, 4);
  const T = (txt, x, y, size, color, weight = 800, align = "left") => { g.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`; g.fillStyle = color; g.textAlign = align; g.fillText(txt, x, y); };
  T("MIDNIGHT BURN", 70, 110, 44, "#ffffff", 900); T(IS_TOKYO ? "TOKYO DRIFT" : "MUMBAI DRIFT", 70, 160, 28, "#9fd4ff", 700);
  const head = c.kind === "bust" ? "BUSTED" : c.kind === "hideout" ? "LOST THEM" : "ESCAPED";
  T(head, 70, 330, 130, accent, 900); T(`HEAT ${c.heat}  ·  ${c.name}`, 70, 400, 50, "#ffffff", 800);
  if (win) { T("BANKED", 70, 560, 34, "#9fd4ff", 700); T(`${CUR}${num(c.banked + c.bounty)}`, 70, 680, 150, "#ffd23b", 900); }
  else { T("LOST", 70, 560, 34, "#ffb0b0", 700); T(`${CUR}${num(c.lost)}`, 70, 680, 150, "#ff9a9a", 900); }
  const rows = [["TIME IN CHASE", `${c.time} s`], ["UNITS WRECKED", `${c.wrecks}`], ["NEAR MISSES", `${c.near}`], ["BEST MULTIPLIER", `x${c.mult}`]];
  rows.forEach((r, i) => { const y = 800 + i * 84; T(r[0], 70, y, 30, "#9aa3c7", 700); T(r[1], W - 70, y, 44, "#ffffff", 900, "right"); g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(70, y + 22, W - 140, 2); });
  if (c.moments && c.moments.length) { T(c.moments[0].toUpperCase(), 70, 1190, 36, "#ffd23b", 800); if (c.moments[1]) T(c.moments[1].toUpperCase(), 70, 1240, 30, "#ffe08a", 700); }
  T(who.car ? who.car.toUpperCase() : "", 70, 1300, 26, "#9aa3c7", 700); T("tapandscore.com", W - 70, 1300, 30, "#ffffff", 800, "right");
  return cv;
}
const toBlob = (cv) => new Promise((res) => cv.toBlob(res, "image/png"));
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
export async function shareCard(c, who) {
  const cv = drawStoryCard(c, who); const blob = await toBlob(cv); const file = new File([blob], "midnight-burn-chase.png", { type: "image/png" });
  const text = c.kind === "bust" ? `Busted at Heat ${c.heat} in Midnight Burn. Lost ${CUR}${num(c.lost)}. Can you do better?` : `Escaped Heat ${c.heat} in Midnight Burn and banked ${CUR}${num(c.banked + c.bounty)}. Beat that.`;
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return "shared"; } } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  download(blob, "midnight-burn-chase.png"); return "saved";
}

// ---- the clip recorder: two recorders take turns, each restarting every 40 s, so there are always 20-40 s of picture ready to save ---------------------------------------------
const clip = { canvas: null, slots: [], timers: [], first: null, mime: "", on: false };
const pickMime = () => { if (typeof MediaRecorder === "undefined") return ""; for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {} } return ""; };
function startSlot(i) {
  try {
    const stream = clip.canvas.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: clip.mime, videoBitsPerSecond: 2500000 }); const s = { rec, chunks: [], t0: performance.now(), stream };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); };
    rec.start(1000); clip.slots[i] = s;
  } catch { clip.slots[i] = null; }
}
function stopSlot(i, keep) {
  const s = clip.slots[i]; if (!s) return Promise.resolve(null); clip.slots[i] = null;
  return new Promise((res) => { s.rec.onstop = () => { try { s.stream.getTracks().forEach((t) => t.stop()); } catch {} res(keep ? new Blob(s.chunks, { type: clip.mime.split(";")[0] }) : null); }; try { s.rec.stop(); } catch { res(null); } });
}
export const clipApi = {
  get supported() { return !!pickMime() && typeof HTMLCanvasElement !== "undefined" && !!HTMLCanvasElement.prototype.captureStream; },
  get on() { return clip.on; },
  get seconds() { const t = clip.slots.filter(Boolean).map((s) => (performance.now() - s.t0) / 1000); return t.length ? Math.floor(Math.max(...t)) : 0; },
  enable(canvas) {
    if (clip.on || !canvas) return false; clip.mime = pickMime(); if (!clip.mime || !canvas.captureStream) return false; clip.canvas = canvas; clip.on = true; clip.slots = [null, null];
    const restart = (k) => { if (!clip.on) return; stopSlot(k, false).then(() => { if (clip.on) startSlot(k); }); };
    startSlot(0); clip.timers = [setInterval(() => restart(0), 40000)];
    clip.first = setTimeout(() => { if (!clip.on) return; startSlot(1); clip.timers.push(setInterval(() => restart(1), 40000)); }, 20000);
    return true;
  },
  disable() { clip.on = false; (clip.timers || []).forEach((t) => clearInterval(t)); clip.timers = []; if (clip.first) clearTimeout(clip.first); for (let i = 0; i < 2; i++) stopSlot(i, false); clip.slots = []; },
  async save() {
    if (!clip.on) return "off"; const ready = clip.slots.map((s, i) => ({ s, i })).filter((x) => x.s && (performance.now() - x.s.t0) > 3000).sort((a, b) => a.s.t0 - b.s.t0)[0];
    if (!ready) return "empty"; const i = ready.i; const blob = await stopSlot(i, true); if (clip.on) startSlot(i); if (!blob || blob.size < 1000) return "empty";
    download(blob, "midnight-burn-clip.webm"); return "saved";
  },
};

// ---- the buttons in the pause menu -------------------------------------------------------------------------------------------------------------------------
export function SharePanel({ G, view }) {
  const [msg, setMsg] = useState(""); const [on, setOn] = useState(clipApi.on); const [sec, setSec] = useState(0);
  useEffect(() => { const t = setInterval(() => setSec(clipApi.seconds), 1000); return () => clearInterval(t); }, []);
  const card = G && G.lastChaseCard; const btn = "rounded-md border px-3 py-2 font-pixel text-[9px] tracking-wider";
  const toggle = () => { if (on) { clipApi.disable(); try { localStorage.setItem("mb-clip", "0"); } catch {} setOn(false); setMsg("Clip recorder off."); } else { const ok = view && clipApi.enable(view.renderer.domElement); if (ok) { try { localStorage.setItem("mb-clip", "1"); } catch {} setOn(true); setMsg("Recording the last 20 to 40 seconds. Slightly slower on weak machines."); } else setMsg("This browser cannot record clips."); } };
  return (
    <div className="rounded-lg border border-white/15 p-3">
      <div className="font-mono text-[10px] text-textDim mb-2 tracking-widest">SHARE</div>
      <div className="grid grid-cols-1 gap-2">
        <button className={btn} style={{ borderColor: card ? "#ffd23b" : "#445", color: card ? "#ffd23b" : "#667", opacity: card ? 1 : 0.6 }} disabled={!card} onClick={async () => setMsg((await shareCard(card, { car: G.career && G.career.car })) === "saved" ? "Story card saved as a picture." : "Shared.")}>{card ? "SHARE YOUR LAST CHASE (PICTURE)" : "SHARE YOUR LAST CHASE · finish a chase first"}</button>
        {clipApi.supported && <button className={btn} style={{ borderColor: on ? "#6bffb0" : "#9fd4ff", color: on ? "#6bffb0" : "#9fd4ff" }} onClick={toggle}>{on ? `CLIP RECORDER ON · ${sec}s READY · TURN OFF` : "TURN ON CLIP RECORDER"}</button>}
        {clipApi.supported && on && <button className={btn} style={{ borderColor: "#ff9bea", color: "#ff9bea" }} onClick={async () => { const r = await clipApi.save(); setMsg(r === "saved" ? "Clip saved. Check your downloads." : "Not enough recorded yet. Keep driving a few seconds and try again."); }}>SAVE THE LAST CLIP (VIDEO)</button>}
      </div>
      {msg && <p className="font-mono text-[10px] text-textDim mt-2">{msg}</p>}
      <p className="font-mono text-[10px] text-textDim mt-2">The clip shows the game picture only (no menus). It keeps at most the last 40 seconds and nothing is uploaded: the file goes to your downloads.</p>
    </div>
  );
}

// ---- Upgrade 81: the weekly target, the season and the heat mastery badges (pause menu) ----------------------------------------------------------------------------
export function RetentionPanel({ G }) {
  const [, bump] = useState(0); useEffect(() => { const t = setInterval(() => bump((x) => x + 1), 2000); return () => clearInterval(t); }, []);
  const R = G && G.retention ? G.retention() : null; if (!R) return null; const w = R.weekly, s = R.season;
  return (
    <div className="rounded-lg border border-white/15 p-3">
      <div className="font-mono text-[10px] text-textDim mb-2 tracking-widest">MOST WANTED OF THE WEEK</div>
      <p className="font-pixel text-[10px]" style={{ color: w.done ? "#6bffb0" : "#ffd23b" }}>{w.done ? "DONE · " : ""}{w.text.toUpperCase()}</p>
      <div className="h-1.5 rounded mt-2" style={{ background: "#222238" }}><div className="h-1.5 rounded" style={{ width: `${Math.min(100, (w.p / w.goal) * 100)}%`, background: w.done ? "#6bffb0" : "#ffd23b" }} /></div>
      <p className="font-mono text-[10px] text-textDim mt-1">{w.p.toLocaleString("en-US")} / {w.goal.toLocaleString("en-US")} · pays {CUR}{num(w.cash)} + {w.xp} XP · resets in {w.daysLeft} day{w.daysLeft === 1 ? "" : "s"}</p>
      <p className="font-pixel text-[9px] mt-3" style={{ color: "#9fd4ff" }}>SEASON {s.n} · {s.name} · WEEK {s.week} OF {s.weeks}</p>
      <p className="font-mono text-[10px] text-textDim">Weekly targets done this season: {s.pts} of {s.weeks}. Finish all {s.weeks} for {CUR}{num(s.finishCash)}{s.paid ? " (paid)" : ""}.</p>
      <p className="font-pixel text-[9px] mt-3" style={{ color: "#ff9bea" }}>HEAT MASTERY · {R.total} OF 18 BADGES</p>
      <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: "auto 1fr 1fr 1fr" }}>
        <span /><span className="font-mono text-[9px] text-textDim">ESCAPE</span><span className="font-mono text-[9px] text-textDim">5 WRECKS</span><span className="font-mono text-[9px] text-textDim">UNTOUCHABLE</span>
        {R.mastery.map((m) => (<span key={"r" + m.h} style={{ display: "contents" }}><span className="font-mono text-[9px] text-textDim">HEAT {m.h}</span>{[m.e, m.w, m.c].map((on, i) => <span key={i} className="font-mono text-[11px]" style={{ color: on ? "#6bffb0" : "#334" }}>{on ? "● done" : "○"}</span>)}</span>))}
      </div>
      <p className="font-mono text-[10px] text-textDim mt-2">Each badge pays cash once. Higher heat badges also count for the lower levels.</p>
    </div>
  );
}
