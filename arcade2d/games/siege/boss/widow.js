// Boss 2 — the Neon Widow (Neon Strip). A spider mech that hangs from a glowing cable above the street.
// She fans out lightning bolts, calls down lightning columns, and sometimes drops to the street for a smash.
// Weak point: the glowing diamond on her back. She is easiest to hit right after a smash, while she is on the ground.
import { Boss, FLOOR_Y, groundMark, drawColumn, shadow } from "./base";
import { clamp, TAU, lerp, damp } from "../../../core/util";
import { FX } from "../../../core/fx";
import { circle, ellipse, fillRR, poly, line, capsule, glow, lin, rad, text, OUT } from "../../../core/draw";

const HANG = 256, GROUND = FLOOR_Y - 44;

export class Widow extends Boss {
  constructor(S, spawn) {
    super(S, spawn, { name: "Neon Widow", hp: 440, keepAway: 0, phases: [0.5], hint: "Stand under her and shoot up at the glowing diamond. Keep moving!" });
    this.x = this.x0 + 500; this.y = -120; this.vy = 0; this.sub = ""; this.subT = 0; this.cool = 1.0; this.si = 0; this.fired = 0; this.waitT = 0; this.sweeping = 0; this.target = this.x;
    this.seq = ["bolts", "strikes", "bolts", "slam", "strikes"]; this.seq2 = ["bolts", "slam", "summon", "strikes", "bolts", "slam"];
  }

  grounded() { return clamp((this.y - 330) / (GROUND - 330), 0, 1); }
  boxes() {
    const x = this.x, y = this.y, k = 1 + 0.35 * this.grounded();
    return [
      { x: x - 40, y: y - 32, w: 80, h: 88, mul: 2.0 * k, weak: 2.0 * k },   // the glowing diamond and the face under it: the first thing a shot from the street meets
      { x: x - 54, y: y - 50, w: 108, h: 86, mul: 1.0 * k },                   // the rest of the body
    ];
  }

  think(S, dt) {
    const H = S.hero, ph2 = this.phase > 1, spd = ph2 ? 250 : 180;
    switch (this.st) {
      case "intro": { // she lowers herself from the dark on her cable
        const k = clamp(this.stT / 1.5, 0, 1); this.y = lerp(-120, HANG, 1 - Math.pow(1 - k, 3));
        if (this.stT > 1.7) { this.invuln = false; this.go("idle"); if (this.hint) S.showTip(this.hint, 4.5); }
        break;
      }
      case "idle":
        this.hover(S, dt, H.x + Math.sin(this.t * 0.8) * 90, spd);
        this.cool -= dt; if (this.cool <= 0) this.start(S, (ph2 ? this.seq2 : this.seq)[this.si++ % (ph2 ? this.seq2 : this.seq).length]);
        break;
      case "bolts": {
        this.hover(S, dt, this.x, 0);
        const charge = 0.7, volleys = ph2 ? 2 : 1;
        for (let v = 0; v < volleys; v++) if (this.fired === v && this.stT >= charge + v * 0.5) { this.fireBolts(S); this.fired++; }
        if (this.stT > charge + (volleys - 1) * 0.5 + 0.8) { this.cool = ph2 ? 0.7 : 1.2; this.go("idle"); }
        break;
      }
      case "strikes":
        this.hover(S, dt, this.x, 0);
        if (this.stT > this.waitT) { this.cool = ph2 ? 0.7 : 1.2; this.go("idle"); }
        break;
      case "summon":
        this.hover(S, dt, this.x, 0);
        if (this.stT > 1.6) { this.cool = 0.9; this.go("idle"); }
        break;
      case "slam": this.slam(S, dt, ph2); break;
      default: break;
    }
    if (this.st !== "slam" && this.st !== "intro") this.y = lerp(this.y, HANG + Math.sin(this.t * 2) * 7, Math.min(1, dt * 6));
    this.x = clamp(this.x, this.x0 + 100, this.x1 - 100);
  }
  hover(S, dt, tx, spd) { const d = clamp(tx, this.x0 + 100, this.x1 - 100) - this.x; this.x += clamp(d, -spd * dt, spd * dt); }

  start(S, a) {
    const H = S.hero, ph2 = this.phase > 1;
    this.go(a); this.sub = a === "slam" ? "track" : ""; this.subT = 0; this.fired = 0;
    if (a === "bolts") S.sfx.alarm();
    if (a === "strikes") {
      const n = ph2 ? 5 : 3, xs = [H.x, H.x - 190, H.x + 190, H.x - 380, H.x + 380].slice(0, n);
      xs.forEach((x, i) => this.strike(S, clamp(x, this.x0 + 80, this.x1 - 80), 1.0 + i * 0.14));
      this.waitT = 1.0 + n * 0.14 + 0.9; S.sfx.alarm();
    }
    if (a === "summon") { S.sfx.alarm(); for (const d of [-1, 1]) if (this.alive() < 3) this.spawnMinion(S, "d", this.x + d * 70, this.y + 24); }
  }
  fireBolts(S) {
    const H = S.hero, ph2 = this.phase > 1, n = ph2 ? 7 : 5, spread = ph2 ? 1.0 : 0.82;
    const base = clamp(Math.atan2(H.y - 40 - (this.y + 34), H.x - this.x), 0.4, Math.PI - 0.4);
    for (let i = 0; i < n; i++) this.shoot(S, this.x, this.y + 34, base + (i / (n - 1) - 0.5) * spread, 350, 10, "bolt", "#c9b8ff", { life: 2.6 });
    S.sfx.laser(); S.cam.shake(3, 0.15); FX.sparks(S.fx, this.x, this.y + 34, 8, "#c9b8ff");
  }
  // lightning: a warning on the street, then a column from the sky
  strike(S, x, delay) {
    this.addHaz({
      kind: "rect", x: x - 26, y: 110, w: 52, h: FLOOR_Y - 110, delay, life: 0.42, dmg: 18, color: "#8e6bff",
      tick: (z) => { if (!z.fired) { z.fired = true; S.cam.shake(5, 0.2); S.sfx.explode(); FX.sparks(S.fx, x, FLOOR_Y - 4, 12, "#e6dcff"); FX.dust(S.fx, x, FLOOR_Y, 5); } },
      draw: (g, z, t) => { if (z.age < z.delay) { groundMark(g, x, FLOOR_Y, 44, z.age / z.delay, t, "#c9a8ff"); g.save(); g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 24); g.strokeStyle = "#c9a8ff"; g.lineWidth = 2; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(x, 130); g.lineTo(x, FLOOR_Y - 6); g.stroke(); g.restore(); } else drawColumn(g, z, t); },
    });
  }

  slam(S, dt, ph2) {
    const H = S.hero, track = ph2 ? 0.7 : 0.9;
    if (this.sub === "track") {
      if (this.stT < track - 0.4) this.target = clamp(H.x, this.x0 + 110, this.x1 - 110);
      this.hover(S, dt, this.target, 430);
      if (this.stT >= track) { this.sub = "drop"; this.vy = 0; S.sfx.whoosh(); }
    } else if (this.sub === "drop") {
      this.vy += 5600 * dt; this.y += this.vy * dt;
      if (this.y >= GROUND) { this.y = GROUND; this.impact(S, ph2); this.sub = "down"; this.subT = 0; this.sweeping = 0; }
    } else if (this.sub === "down") {          // on the ground: shoot her now! Her legs sweep around now and then, so don't stand too close.
      this.subT += dt;
      for (const at of [0.55, 1.45]) if (this.subT >= at && this.sweeping === (at < 1 ? 0 : 1)) { this.legSweep(S); this.sweeping++; }
      if (this.subT > (ph2 ? 2.2 : 2.9)) this.sub = "climb";
    } else if (this.sub === "climb") {
      this.y -= 520 * dt; if (this.y <= HANG) { this.y = HANG; this.cool = ph2 ? 0.7 : 1.3; this.go("idle"); }
    }
  }
  impact(S, ph2) {
    S.cam.shake(13, 0.5); S.sfx.boom(); FX.dust(S.fx, this.x, FLOOR_Y, 16);
    for (const d of [-1, 1]) this.addHaz({ kind: "wave", x: this.x - 23 + d * 40, y: FLOOR_Y - 32, w: 46, h: 32, vx: d * (ph2 ? 380 : 320), life: 4, dmg: 16, tick: (z, dt2) => { if (Math.random() < dt2 * 16) FX.dust(S.fx, z.x + z.w / 2, FLOOR_Y, 2); } });
  }
  legSweep(S) {
    const x = this.x; S.sfx.alarm();
    this.addHaz({
      kind: "rect", x: x - 190, y: FLOOR_Y - 52, w: 380, h: 52, delay: 0.42, life: 0.22, dmg: 16, color: "#ff5ad8",
      tick: (z) => { if (!z.fired) { z.fired = true; S.cam.shake(5, 0.18); S.sfx.whoosh(); FX.sparks(S.fx, x - 170, FLOOR_Y - 30, 6, "#ff9ae8"); FX.sparks(S.fx, x + 170, FLOOR_Y - 30, 6, "#ff9ae8"); } },
      draw: (g, z, t) => {
        if (z.age < z.delay) { g.save(); g.globalAlpha = 0.18 + 0.14 * Math.sin(t * 30); g.fillStyle = "#ff3ea5"; g.fillRect(z.x, z.y + 18, z.w, z.h - 18); g.restore(); }
        else { g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = "#ffd0f4"; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(z.x, FLOOR_Y - 30); g.lineTo(z.x + z.w, FLOOR_Y - 30); g.stroke(); g.strokeStyle = "rgba(255,62,165,.5)"; g.lineWidth = 22; g.stroke(); g.restore(); }
      },
    });
  }
  enterPhase(S) {
    super.enterPhase(S); S.showTip("The Widow is furious! She calls drones and more lightning.", 3.2); S.say("Here we go again...", 2.2, true);
    this.bonus(S, "med"); this.bonus(S, "ammo"); FX.explosion(S.fx, this.x, this.y, 1.1);
  }
  updateDead(S, dt) {
    this.vy += 2200 * dt; this.y = Math.min(GROUND, this.y + this.vy * dt); if (this.y >= GROUND) this.vy = 0;
    if (this.deadT < 2.2 && Math.random() < dt * 16) FX.explosion(S.fx, this.x - 60 + Math.random() * 120, this.y - 50 + Math.random() * 90, 0.7);
  }

  // ------------------------------------------------------------------------------------------------------------------ drawing
  drawBody(g, S, t) {
    const hurt = this.flash > 0, x = this.x, y = this.y, alpha = this.fade(), gr = this.grounded(); if (alpha <= 0.01) return;
    const charge = (this.st === "bolts" && this.stT < 0.7) ? this.stT / 0.7 : 0, pulse = 0.5 + 0.5 * Math.sin(t * 8), dark = hurt ? "#ffffff" : "#2a1b57", mid = hurt ? "#ffffff" : "#5a3a9a", neon = "#ff4bd8";
    g.save(); g.globalAlpha = alpha;
    if (gr > 0.3) shadow(g, x, FLOOR_Y - 1, 120, 0.35 * gr);
    // the cable she hangs from
    if (gr < 0.95) { line(g, x, -80, x, y - 46, "rgba(21,10,51,.95)", 8); g.save(); g.globalCompositeOperation = "lighter"; line(g, x, -80, x, y - 46, "#ff7ae0", 2.6 + pulse); line(g, x, -80, x, y - 46, "rgba(255,75,216,.35)", 9); g.restore(); }
    // eight legs
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const wob = Math.sin(t * 3.2 + i * 1.4 + (s > 0 ? 1.8 : 0)), sweepLift = this.haz.some((z) => z.kind === "rect" && z.color === "#ff5ad8" && z.age < z.delay) ? 34 : 0;
      const rx = x + s * (28 + i * 5), ry = y - 16 + i * 11, tx = x + s * (92 + i * 28 + wob * 4), ty = Math.min(FLOOR_Y - 2, y + 58 + i * 15 + wob * 7 - sweepLift * (i % 2 ? 0.4 : 1));
      const kx = rx + s * (46 + i * 6), ky = Math.min(ry, ty) - 48 + i * 7;
      capsule(g, rx, ry, kx, ky, 7, dark, OUT, 2.6); capsule(g, kx, ky, tx, ty, 5, mid, OUT, 2.6);
      circle(g, kx, ky, 7, neon, OUT, 2.2); circle(g, tx, ty, 4, hurt ? "#fff" : "#ffd0f4", OUT, 1.8);
    }
    // the body: abdomen (with the diamond), thorax and head with its eyes
    ellipse(g, x, y - 6, 54, 42, hurt ? "#fff" : lin(g, 0, y - 48, 0, y + 36, [[0, "#7a4cc4"], [1, "#2a1b57"]]), OUT, 3.6);
    g.save(); g.beginPath(); g.ellipse(x, y - 6, 54, 42, 0, 0, TAU); g.clip(); g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x - 46, y - 40, 30, 8); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x - 60, y + 14, 120, 30); g.restore();
    ellipse(g, x, y + 32, 32, 22, hurt ? "#fff" : mid, OUT, 3.2);
    // the weak spot: a glowing diamond
    const gl = 0.55 + 0.45 * pulse + charge * 0.8;
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y - 8, 56 + charge * 26, neon, 0.45 * gl); g.restore();
    poly(g, [[x, y - 32], [x + 22, y - 8], [x, y + 16], [x - 22, y - 8]], hurt ? "#fff" : lin(g, 0, y - 32, 0, y + 16, [[0, "#ffd0f4"], [1, neon]]), OUT, 3);
    poly(g, [[x, y - 22], [x + 11, y - 8], [x, y + 6], [x - 11, y - 8]], "rgba(255,255,255,.55)", null);
    // eyes
    for (const [ex, ey, er] of [[-13, 28, 5], [13, 28, 5], [-5, 36, 3.4], [5, 36, 3.4]]) { circle(g, x + ex, y + ey, er, "#1a1030", OUT, 1.6); circle(g, x + ex, y + ey, er * 0.62, charge > 0 && Math.floor(t * 16) % 2 ? "#fff" : "#ff3ea5"); }
    capsule(g, x - 8, y + 48, x - 11, y + 58, 3.2, "#c9cfe8", OUT, 1.8); capsule(g, x + 8, y + 48, x + 11, y + 58, 3.2, "#c9cfe8", OUT, 1.8);
    if (this.sub === "down" && !this.dead) text(g, "SHOOT HER!", x, y - 70, { size: 15, color: "#ffe27a", align: "center", stroke: OUT, strokeW: 5, weight: 900, alpha: 0.7 + 0.3 * pulse });
    g.restore();
  }
}
