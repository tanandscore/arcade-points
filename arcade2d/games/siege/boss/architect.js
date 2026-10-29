// Boss 4 — The Architect (Skyline Spire). A floating fortress built out of glowing blocks.
// Phase 1: four shield blocks circle the core. Shoot them down (they also block bullets).
// Phase 2: the core is bare. It fires expanding rings of bullets (each ring has gaps to slip through) and walls of light with exactly one safe gap.
// Phase 3: below a third of its health, everything speeds up.
import { Boss, FLOOR_Y, groundMark, drawColumn, shadow } from "./base";
import { clamp, TAU, lerp, damp } from "../../../core/util";
import { FX } from "../../../core/fx";
import { circle, ellipse, fillRR, poly, line, capsule, glow, lin, rad, text, OUT } from "../../../core/draw";

const HOVER = 262, POD_HP = 22, CORE_HP = 360, POD_R = 124;
const CYAN = "#3ee6e0", CYAN2 = "#e6fffe", MAG = "#ff3ea5";

export class Architect extends Boss {
  constructor(S, spawn) {
    super(S, spawn, { name: "The Architect", hp: POD_HP * 4 + CORE_HP, keepAway: 340, phases: [], hint: "Shoot the four shield blocks first. Then hit the glowing core!" });
    this.x = this.x0 + 480; this.y = HOVER; this.tx = this.x; this.coreHp = CORE_HP; this.podA = 0; this.shield = 0; this.sub = ""; this.cool = 1.0; this.si = 0; this.waitT = 0; this.emitT = 0; this.sp = 0; this.spin = 0; this.gridGap = 3; this.vx = 0;
    this.pods = [0, 1, 2, 3].map((i) => ({ hp: POD_HP, flash: 0, i }));
    this.seq1 = ["lasers", "bombs", "jets", "lasers", "bombs"]; this.seq2 = ["rings", "grid", "lasers", "jets", "rings", "bombs"]; this.seq3 = ["rings", "grid", "bombs", "grid", "lasers"];
  }

  podPos(p) { const a = this.podA + (p.i * Math.PI) / 2; return { x: this.x + Math.cos(a) * POD_R, y: this.y + Math.sin(a) * POD_R * 0.6 }; }
  alivePods() { return this.pods.filter((p) => p.hp > 0); }
  boxes() {
    const out = [];
    for (const p of this.pods) if (p.hp > 0) { const c = this.podPos(p); out.push({ x: c.x - 25, y: c.y - 25, w: 50, h: 50, mul: 1, pod: p }); }
    out.push({ x: this.x - 42, y: this.y - 42, w: 84, h: 84, mul: this.alivePods().length ? 0 : 1, core: true });   // the core (shielded while any block lives)
    return out;
  }
  aimPoint() {
    const alive = this.alivePods(); if (!alive.length) return { x: this.x, y: this.y };
    const H = this.S.hero; let best = null, bd = 1e9; for (const p of alive) { const c = this.podPos(p), d = Math.abs(c.x - H.x) + Math.abs(c.y - H.y) * 0.3 - (c.y > this.y ? 40 : 0); if (d < bd) { bd = d; best = c; } } return best;
  }
  damage(S, dmg, mul = 1, p = null, box = null) {
    if (this.dead || this.invuln) return;
    box = box || (p && (this.hitTest(p.x, p.y, 4) || {}).box) || null;
    if (box && box.pod) {
      const pod = box.pod, v = Math.min(pod.hp, dmg * mul); pod.hp -= v; pod.flash = 0.1; this.hp -= v; this.hurtFx(S, v, 1);
      if (pod.hp <= 0.001) this.popPod(S, pod);
    } else if (box && box.core && mul > 0) {
      const v = dmg * mul; this.coreHp -= v; this.hp = Math.max(0, this.hp - v); this.hurtFx(S, v, mul);
      if (this.coreHp <= 0) { this.hp = 0; this.die(S); }
    } else { this.shield = 0.2; S.sfx.impact(); this.deflect(S, p); }
  }
  popPod(S, pod) {
    const c = this.podPos(pod); FX.explosion(S.fx, c.x, c.y, 0.8); S.sfx.explode(); S.cam.shake(6, 0.25); S.addScore(300, c.x, c.y - 30, "#9ff6ff", 16);
    if (!this.alivePods().length && this.phase === 1) { this.phase = 2; this.enterPhase(S, 2); }
  }

  checkPhase(S) { if (this.phase === 2 && this.coreHp <= CORE_HP * 0.3) { this.phase = 3; this.enterPhase(S, 3); } }
  enterPhase(S, n) {
    super.enterPhase(S);
    if (n === 2) { S.showTip("Shields down! Shoot the core. Watch for the walls of light: find the gap!", 3.8); S.say("Now it's personal.", 2.2, true); this.cool = 1.4; }
    else { S.showTip("The Architect is unstable! Everything is faster!", 3.2); S.say("Hang in there, Rex!", 2.2, true); this.cool = 0.8; }
    this.bonus(S, "med"); this.bonus(S, "ammo"); if (n === 2) this.bonus(S, "med");
    FX.explosion(S.fx, this.x, this.y, 1.4);
  }

  think(S, dt) {
    const H = S.hero, ph = this.phase, sp = ph >= 3 ? 1.3 : 1;
    this.spin += dt * (ph >= 3 ? 1.6 : 0.8); this.shield = Math.max(0, this.shield - dt); for (const p of this.pods) p.flash = Math.max(0, p.flash - dt);
    if (ph === 1) this.podA += dt * 1.1;
    if (this.st !== "bombs" && this.st !== "intro") { // drift slowly from side to side over the arena
      const target = this.x0 + 480 + Math.sin(this.t * 0.55 * sp) * 250 + 0;
      this.x = damp(this.x, this.st === "rings" || this.st === "grid" ? this.x : target, 2.2, dt);
    }
    this.y = HOVER + Math.sin(this.t * 1.6) * 10;
    switch (this.st) {
      case "intro":
        if (this.stT > 2.0) { this.invuln = false; this.go("idle"); if (this.hint) S.showTip(this.hint, 4.5); }
        break;
      case "idle": {
        this.cool -= dt; if (this.cool <= 0) { const seq = ph >= 3 ? this.seq3 : ph >= 2 ? this.seq2 : this.seq1; this.start(S, seq[this.si++ % seq.length]); }
        break;
      }
      case "lasers": case "jets": case "grid":
        if (this.stT > this.waitT) { this.cool = ph >= 3 ? 0.6 : ph >= 2 ? 0.9 : 1.3; this.go("idle"); }
        break;
      case "bombs": this.bombRun(S, dt, sp); break;
      case "rings": this.rings(S, dt, ph); break;
      default: break;
    }
  }

  start(S, a) {
    const H = S.hero, ph = this.phase;
    this.go(a); this.sub = a === "bombs" ? "move" : ""; this.emitT = 0; this.ringN = 0;
    if (a === "lasers") {
      const n = ph >= 3 ? 5 : ph >= 2 ? 4 : 3, offs = [0, -170, 170, -340, 340];
      for (let i = 0; i < n; i++) this.beam(S, clamp(H.x + offs[i] + (i ? (Math.random() - 0.5) * 50 : 0), this.x0 + 70, this.x1 - 70), 1.0 + i * 0.12, 46);
      this.waitT = 1.0 + n * 0.12 + 0.8; S.sfx.alarm();
    } else if (a === "jets") {
      for (const x of [this.x0 + 80, this.x1 - 80]) if (this.alive() < 3) this.spawnMinion(S, "j", x, 230);
      this.waitT = 1.4; S.sfx.alarm();
    } else if (a === "grid") {
      // eight slots across the arena. All but one flash and then fire: stand in the gap!
      const slots = 8, w = (this.x1 - this.x0 - 96) / slots, hg = Math.round((H.x - (this.x0 + 48)) / w - 0.5);
      let gap = clamp(hg + Math.floor(Math.random() * 7) - 3, 0, slots - 1); if (gap === this.gridGap && Math.random() < 0.6) gap = clamp(gap + (Math.random() < 0.5 ? -2 : 2), 0, slots - 1); this.gridGap = gap;
      const warn = ph >= 3 ? 1.5 : 1.8;
      for (let k = 0; k < slots; k++) if (k !== gap) this.beam(S, this.x0 + 48 + (k + 0.5) * w, warn, w, true);
      this.safeX = this.x0 + 48 + (gap + 0.5) * w; this.safeW = w; this.safeT = warn;
      this.waitT = warn + 1.0; S.sfx.alarm();
    } else if (a === "bombs") S.sfx.alarm();
    else if (a === "rings") S.sfx.alarm();
  }
  // a column of light from the sky: a warning line first, then the beam. wide=true draws the "wall" style
  beam(S, x, delay, w, wall = false) {
    this.addHaz({
      kind: "rect", x: x - w / 2, y: 100, w, h: FLOOR_Y - 100, delay, life: 0.5, dmg: wall ? 24 : 20, color: wall ? "#6fa8ff" : CYAN, color2: CYAN2,
      tick: (z) => { if (!z.fired) { z.fired = true; S.cam.shake(wall ? 4 : 6, 0.2); S.sfx.explode(); FX.sparks(S.fx, x, FLOOR_Y - 4, wall ? 5 : 12, CYAN2); } },
      draw: (g, z, t) => {
        if (z.age < z.delay) {
          const k = z.age / z.delay;
          if (wall) { g.save(); g.globalAlpha = 0.2 + 0.1 * Math.sin(t * 22) + 0.16 * k; g.fillStyle = "#6fa8ff"; g.fillRect(z.x + 3, z.y + 30, z.w - 6, z.h - 30); g.globalAlpha = 0.6; g.strokeStyle = "#a9c8ff"; g.lineWidth = 2; g.setLineDash([12, 10]); g.strokeRect(z.x + 3, z.y + 30, z.w - 6, z.h - 30); g.restore(); }
          else { groundMark(g, x, FLOOR_Y, 42, k, t, CYAN); g.save(); g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 24); g.strokeStyle = CYAN; g.lineWidth = 2; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(x, 130); g.lineTo(x, FLOOR_Y - 6); g.stroke(); g.restore(); }
        } else drawColumn(g, z, t);
      },
    });
  }

  // fly to one end of the arena, flash, then sweep across dropping bombs. Run ahead of them!
  bombRun(S, dt, sp) {
    if (this.sub === "move") {
      if (this.runDir == null) { this.runDir = this.x < this.x0 + 480 ? -1 : 1; this.goalX = this.runDir < 0 ? this.x1 - 120 : this.x0 + 120; }
      this.x += clamp(this.goalX - this.x, -560 * dt, 560 * dt);
      if (Math.abs(this.goalX - this.x) < 6) { this.sub = "wait"; this.subT = 0; S.sfx.alarm(); }
    } else if (this.sub === "wait") {
      this.subT += dt; if (this.subT > 0.5) { this.sub = "run"; this.emitT = 0; S.sfx.whoosh(); }
    } else if (this.sub === "run") {
      this.x += this.runDir * 330 * sp * dt; this.emitT -= dt;
      while (this.emitT <= 0) { this.emitT += 0.26 / sp; this.shoot(S, this.x, this.y + 50, Math.PI / 2, 30, 16, "bomb", CYAN, { g: 1000, boom: 70 }); }
      if ((this.runDir > 0 && this.x >= this.x1 - 110) || (this.runDir < 0 && this.x <= this.x0 + 110)) { this.sub = ""; this.runDir = null; this.cool = 1.0; this.go("idle"); }
    }
  }
  // expanding rings of bullets, one after another; every ring is a different shape, so there is always a gap to slip through
  rings(S, dt, ph) {
    const charge = 0.9, n = ph >= 3 ? 18 : 14, every = ph >= 3 ? 0.66 : 0.82, rounds = ph >= 3 ? 5 : 4, spd = ph >= 3 ? 245 : 215;
    if (this.stT < charge) return;
    const t = this.stT - charge;
    this.emitT -= dt;
    while (this.emitT <= 0 && this.ringN < rounds) {
      this.emitT += every; const off = (this.ringN % 2 ? 0.5 : 0) * TAU / n + this.ringN * 0.13;
      for (let k = 0; k < n; k++) this.shoot(S, this.x, this.y, off + (k * TAU) / n, spd, 8, "ebullet", "#ff5aa5", { life: 3.4 });
      S.sfx.smg(); S.cam.shake(2, 0.1); FX.pop(S.fx, this.x, this.y, "#ff5aa5", 10); this.ringN++;
    }
    if (this.ringN >= rounds && t > rounds * every + 1.3) { this.cool = 0.9; this.go("idle"); }
  }

  updateDead(S, dt) {
    this.y = Math.min(FLOOR_Y - 70, this.y + 160 * dt * (1 + this.deadT));
    if (this.deadT < 2.2 && Math.random() < dt * 20) FX.explosion(S.fx, this.x - 90 + Math.random() * 180, this.y - 60 + Math.random() * 120, 0.8);
  }

  // ------------------------------------------------------------------------------------------------------------------ drawing
  drawBody(g, S, t) {
    const hurt = this.flash > 0, x = this.x, y = this.y, alpha = this.fade(); if (alpha <= 0.01) return;
    const exposed = !this.alivePods().length, pulse = 0.5 + 0.5 * Math.sin(t * 7), ph = this.phase, charge = this.st === "rings" && this.stT < 0.9 ? this.stT / 0.9 : 0;
    const dark = hurt ? "#ffffff" : "#1c2457", mid = hurt ? "#ffffff" : "#34419a", rageC = ph >= 3 ? MAG : CYAN;
    g.save(); g.globalAlpha = alpha;
    shadow(g, x, FLOOR_Y - 1, 90, 0.18);
    // thruster glow
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y + 78, 70, rageC, 0.35 + 0.15 * pulse); g.restore();
    // energy tethers to the shield blocks
    for (const p of this.alivePods()) { const c = this.podPos(p); g.save(); g.globalCompositeOperation = "lighter"; line(g, x, y, c.x, c.y, "rgba(62,230,224,.35)", 7); line(g, x, y, c.x, c.y, CYAN2, 1.6); g.restore(); }
    // crown and cannons
    for (const s of [-1, 0, 1]) { capsule(g, x + s * 24, y - 56, x + s * 34, y - 92 + (s === 0 ? -8 : 0), 4, dark, OUT, 2.4); circle(g, x + s * 34, y - 94 + (s === 0 ? -8 : 0), 5, rageC, OUT, 2); }
    for (const s of [-1, 1]) { capsule(g, x + s * 62, y + 20, x + s * 84, y + 50, 9, mid, OUT, 3); circle(g, x + s * 86, y + 52, 8, "#1a1030", OUT, 2.4); circle(g, x + s * 86, y + 52, 4, charge > 0 ? "#fff" : MAG); }
    // the octagon ring
    g.save(); g.translate(x, y); g.rotate(this.spin * 0.3);
    g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16; g.lineTo(Math.cos(a) * 78, Math.sin(a) * 78); } g.closePath();
    g.lineWidth = 17; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke(); g.lineWidth = 12; g.strokeStyle = hurt ? "#fff" : lin(g, -70, -70, 70, 70, [[0, "#4a5cc4"], [1, "#222a6e"]]); g.stroke();
    g.lineWidth = 3; g.strokeStyle = hurt ? "#fff" : rageC; g.globalAlpha = alpha * (0.6 + 0.4 * pulse); g.stroke(); g.globalAlpha = alpha;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16; circle(g, Math.cos(a) * 78, Math.sin(a) * 78, 6, hurt ? "#fff" : "#8fb0ff", OUT, 2); }
    g.restore();
    // the core
    const R = 34 + charge * 8;
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, 80 + charge * 40, rageC, (exposed ? 0.55 : 0.3) + 0.2 * pulse + charge * 0.4); g.restore();
    circle(g, x, y, R, hurt ? "#fff" : rad(g, x - 8, y - 8, 3, R + 6, [[0, "#ffffff"], [0.45, exposed ? "#9ffff9" : "#7fb6ff"], [1, ph >= 3 ? "#a02060" : "#1f5bd6"]]), OUT, 3.4);
    g.save(); g.beginPath(); g.arc(x, y, R - 2, 0, TAU); g.clip(); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1.4; g.translate(x, y); g.rotate(this.spin);
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 11, -40); g.lineTo(k * 11, 40); g.moveTo(-40, k * 11); g.lineTo(40, k * 11); g.stroke(); } g.restore();
    if (!exposed) { g.save(); g.globalAlpha = alpha * (0.22 + 0.5 * (this.shield / 0.2)); g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.lineTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); } g.closePath(); g.fillStyle = "#9ff6ff"; g.fill(); g.lineWidth = 2.4; g.strokeStyle = "#e6fffe"; g.stroke(); g.restore(); }
    else if (!this.dead) text(g, "HIT THE CORE!", x, y - 110, { size: 14, color: "#ffe27a", align: "center", stroke: OUT, strokeW: 5, weight: 900, alpha: 0.6 + 0.4 * pulse });
    // the shield blocks
    for (const p of this.pods) {
      if (p.hp <= 0) continue; const c = this.podPos(p), hv = p.flash > 0;
      g.save(); g.translate(c.x, c.y); g.rotate(Math.sin(t * 2 + p.i) * 0.08);
      g.save(); g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 44, CYAN, 0.35); g.restore();
      fillRR(g, -24, -24, 48, 48, 9, hv ? "#fff" : lin(g, 0, -24, 0, 24, [[0, "#a8f4ff"], [1, "#2f8fd6"]]), OUT, 3.2);
      for (const [sx, sy] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) circle(g, sx, sy, 5, hv ? "#fff" : "#e6fffe", OUT, 1.6);
      const hpK = p.hp / POD_HP; fillRR(g, -20, 28, 40, 6, 3, "rgba(14,6,36,.75)"); fillRR(g, -20, 28, 40 * hpK, 6, 3, "#ff4a6a");
      g.restore();
    }
    // safe-gap arrow for the walls of light
    if (this.st === "grid" && this.safeT != null && this.stT < this.safeT) { g.save(); g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 12); text(g, "▼", this.safeX, FLOOR_Y - 150 + Math.sin(t * 9) * 6, { size: 34, color: "#7dff6a", align: "center", stroke: OUT, strokeW: 6, weight: 900 }); text(g, "SAFE", this.safeX, FLOOR_Y - 118, { size: 13, color: "#7dff6a", align: "center", stroke: OUT, strokeW: 5, weight: 900 }); g.restore(); }
    g.restore();
  }
}
