// Boss 1 — the Crane Colossus (Harbor Front). A dockyard crane that walked off its rails.
// It smashes the floor with a wrecking ball, sweeps the ball along the street and rains mortar bombs.
// Weak point: the operator cab. It drops down within reach every time the ball gets stuck in the ground.
import { Boss, FLOOR_Y, groundMark, shadow } from "./base";
import { clamp, TAU, lerp, damp, rgba } from "../../../core/util";
import { FX } from "../../../core/fx";
import { circle, fillRR, poly, line, capsule, glow, lin, rad, text, OUT } from "../../../core/draw";

const BALL_UP = 284, BALL_DOWN = 486, RAIL_Y = 216, BALL_R = 36;

export class Crane extends Boss {
  constructor(S, spawn) {
    super(S, spawn, { name: "Crane Colossus", hp: 340, keepAway: 330, phases: [0.5], hint: "Shoot the glowing cab! It drops down every time the ball gets stuck." });
    this.bx = this.x0 + 784; this.tx = this.x0 + 430; this.tTarget = this.tx; this.by = BALL_UP; this.bvy = 0; this.low = 0; this.look = 0; this.roll = 0;
    this.seq = ["slam", "rain", "sweep", "slam", "volley", "sweep"]; this.si = 0; this.cool = 1.2; this.sub = ""; this.subT = 0; this.volley = 0; this.fromLeft = false; this.steam = 0;
    this.ball = this.addHaz({ kind: "circle", x: this.tx, y: this.by, r: BALL_R, dmg: 0, life: 1e9, always: true, keep: false, draw: () => {} });
  }

  cab() { const cx = this.bx - 84, cy = 262 + this.low * 66; return { x: cx, y: cy }; }
  boxes() {
    const c = this.cab(), bx = this.bx;
    return [
      { x: c.x - 54, y: c.y - 40, w: 108, h: 80, mul: this.low > 0.5 ? 2.8 : 1.9 },   // the cab: the weak point
      { x: bx - 42, y: 170, w: 84, h: 170, mul: 0.8 },                                  // the tower
      { x: bx - 100, y: 326, w: 200, h: 202, mul: 0.5 },                                // the hull and tracks
    ];
  }
  aimPoint() { const c = this.cab(); return { x: c.x, y: c.y }; }
  deflect(S, p) { if (p) FX.sparks(S.fx, p.x, p.y, 3, "#9ff6ff"); }

  think(S, dt) {
    const H = S.hero, ph2 = this.phase > 1, sp = ph2 ? 1.2 : 1;
    this.roll += dt; this.look = damp(this.look, clamp((H.x - (this.bx - 84)) / 380, -1, 0), 6, dt);
    this.low = damp(this.low, this.st === "slam" && (this.sub === "jam") ? 1 : 0, 6, dt);
    if (Math.random() < dt * (ph2 ? 12 : 5)) FX.smoke(S.fx, this.bx + 72, 330, 7);
    this.ball.x = this.tx; this.ball.y = this.by; this.ball.dmg = (this.st === "slam" || this.st === "sweep") && this.by > 340 ? 28 : 0;
    switch (this.st) {
      case "intro":
        this.tx = damp(this.tx, this.x0 + 430, 3, dt);
        if (this.stT > 1.5) { this.invuln = false; this.go("idle"); if (this.hint) S.showTip(this.hint, 4.5); }
        break;
      case "idle":
        this.tx = damp(this.tx, clamp(H.x, this.x0 + 170, this.x0 + 700), 1.4, dt);
        this.cool -= dt; if (this.cool <= 0) this.start(S, this.seq[this.si++ % this.seq.length]);
        break;
      case "slam": this.slam(S, dt, sp, ph2); break;
      case "sweep": this.sweep(S, dt, sp, ph2); break;
      case "rain":
        if (this.stT > this.waitT) { this.cool = ph2 ? 0.8 : 1.4; this.go("idle"); }
        break;
      case "volley": {
        const n = this.stT < 0.7 ? 0 : Math.min(3, Math.floor((this.stT - 0.7) / 0.5) + 1);   // a short pause first, then three salvos
        while (this.volley < n) { this.fireVolley(S); this.volley++; }
        if (this.stT > 2.8) { this.volley = 0; this.cool = 0.9; this.go("idle"); }
        break;
      }
      default: break;
    }
  }

  start(S, a) {
    const H = S.hero, ph2 = this.phase > 1;
    if (a === "volley" && !ph2) a = "rain";       // rockets only join in the second half of the fight
    this.go(a); this.sub = a === "slam" ? "track" : a === "sweep" ? "move" : ""; this.subT = 0;
    if (a === "sweep") this.fromLeft = H.x > this.x0 + 440;   // start on the far side, then come at you
    if (a === "rain") {
      const n = ph2 ? 7 : 5;
      for (let i = 0; i < n; i++) this.dropBomb(S, clamp(i === 0 ? H.x : H.x + (Math.random() * 2 - 1) * 340, this.x0 + 100, this.x1 - 100), 0.9 + i * 0.17);
      this.waitT = 0.9 + n * 0.17 + 0.9; S.sfx.alarm();
    }
    if (a === "volley") S.sfx.alarm();
  }

  slam(S, dt, sp, ph2) {
    const H = S.hero, track = ph2 ? 0.8 : 1.0, lock = track - 0.4;
    if (this.sub === "track") {                                  // the trolley chases you, then locks on
      if (this.stT < lock) this.tTarget = clamp(H.x, this.x0 + 170, this.x0 + 700);
      this.tx += clamp(this.tTarget - this.tx, -420 * sp * dt, 420 * sp * dt);
      if (this.stT >= track) { this.sub = "drop"; this.bvy = 0; S.sfx.whoosh(); }
    } else if (this.sub === "drop") {                            // the ball falls like a stone
      this.bvy += 3800 * dt; this.by += this.bvy * dt;
      if (this.by >= BALL_DOWN) { this.by = BALL_DOWN; this.impact(S, ph2); this.sub = "jam"; this.subT = 0; }
    } else if (this.sub === "jam") {                             // stuck in the street: the cab leans down. Hit it!
      this.subT += dt; if (Math.random() < dt * 14) FX.smoke(S.fx, this.tx + (Math.random() - 0.5) * 50, BALL_DOWN + 24, 8);
      if (this.subT > (ph2 ? 2.0 : 2.7)) this.sub = "hoist";
    } else if (this.sub === "hoist") {
      this.by -= 560 * dt; if (this.by <= BALL_UP) { this.by = BALL_UP; this.cool = ph2 ? 0.8 : 1.4; this.go("idle"); }
    }
  }
  impact(S, ph2) {
    S.cam.shake(12, 0.5); S.sfx.boom(); FX.dust(S.fx, this.tx, FLOOR_Y, 16); FX.debris(S.fx, this.tx, FLOOR_Y - 10, ["#7c86c8", "#5b64a3", "#c9cfe8"], 10, 1.2);
    for (const d of [-1, 1]) this.addHaz({ kind: "wave", x: this.tx - 23 + d * 30, y: FLOOR_Y - 34, w: 46, h: 34, vx: d * (ph2 ? 400 : 340), life: 4, dmg: 18, tick: (z, dt2) => { if (Math.random() < dt2 * 16) FX.dust(S.fx, z.x + z.w / 2, FLOOR_Y, 2); } });
  }
  sweep(S, dt, sp) {
    const startX = this.fromLeft ? this.x0 + 170 : this.x0 + 700, endX = this.fromLeft ? this.x0 + 700 : this.x0 + 170, dir = this.fromLeft ? 1 : -1;
    if (this.sub === "move") {
      this.tx += clamp(startX - this.tx, -700 * dt, 700 * dt); if (Math.abs(this.tx - startX) < 8) { this.sub = "lower"; this.subT = 0; S.sfx.alarm(); }
    } else if (this.sub === "lower") {                            // the ball comes down and blinks: here it comes!
      this.subT += dt; this.by = lerp(BALL_UP, BALL_DOWN, clamp(this.subT / 0.6, 0, 1));
      if (this.subT > 1.15) { this.sub = "run"; S.sfx.whoosh(); }
    } else if (this.sub === "run") {
      this.tx += dir * 440 * sp * dt; if (Math.random() < dt * 30) FX.dust(S.fx, this.tx, FLOOR_Y, 2);
      if ((dir > 0 && this.tx >= endX) || (dir < 0 && this.tx <= endX)) this.sub = "raise";
    } else if (this.sub === "raise") {
      this.by -= 600 * dt; if (this.by <= BALL_UP) { this.by = BALL_UP; this.cool = 1.2; this.go("idle"); }
    }
  }
  // a mortar bomb: a red ring on the street first, then the bomb arrives exactly when the ring has filled up
  dropBomb(S, x, delay) {
    this.addHaz({ kind: "mark", x, y: FLOOR_Y, r: 56, delay, life: 0.01, dmg: 0, color: "#ff7a2d" });
    this.addHaz({ kind: "mark", x, delay: delay - 0.8, life: 0.01, dmg: 0, draw: () => {}, end: (z, b) => { if (!b.dead) b.shoot(S, x, 40, Math.PI / 2, 60, 20, "bomb", "#ff7a2d", { g: 1500, boom: 76 }); } });
  }
  fireVolley(S) {
    const c = this.cab(), H = S.hero, a = Math.atan2(H.y - 30 - c.y, H.x - c.x);
    for (const off of [-0.17, 0, 0.17]) this.shoot(S, c.x - 50, c.y, a + off, 380, 17, "rocket", "#ff7a45", { boom: 62, life: 2.6 });
    S.sfx.rocket(); S.cam.shake(3, 0.15); FX.smoke(S.fx, c.x - 50, c.y, 9);
  }
  enterPhase(S) {
    super.enterPhase(S); S.showTip("The Colossus is overheating! Watch out for rockets.", 3.2); S.say("Okay, now it's angry.", 2.2, true);
    this.bonus(S, "med"); this.bonus(S, "ammo"); FX.explosion(S.fx, this.bx, 330, 1.2);
  }
  onDeath(S) { this.ball.dmg = 0; this.lethal = false; }
  updateDead(S, dt) {
    this.by = Math.min(BALL_DOWN, this.by + 600 * dt); this.ball.dmg = 0;
    if (this.deadT < 2.2 && Math.random() < dt * 18) FX.explosion(S.fx, this.bx - 90 + Math.random() * 190, 200 + Math.random() * 300, 0.7);
  }

  // ------------------------------------------------------------------------------------------------------------------ drawing
  drawBody(g, S, t) {
    const hurt = this.flash > 0, bx = this.bx, alpha = this.fade(), sink = this.dead ? Math.min(60, this.deadT * 26) : 0, c = this.cab();
    if (alpha <= 0.01) return;
    g.save(); g.globalAlpha = alpha; g.translate(0, sink);
    const metal = hurt ? "#ffffff" : "#6c75b0", metalD = hurt ? "#ffffff" : "#3a4175", yel = hurt ? "#ffffff" : "#ffbe2e", yel2 = hurt ? "#ffffff" : "#e08a0c";
    shadow(g, bx, FLOOR_Y - 1, 150, 0.35);
    // --- tracks
    for (const s of [-1, 1]) {
      const tx = bx + s * 58; fillRR(g, tx - 56, 466, 112, 62, 30, hurt ? "#fff" : "#2a2d57", OUT, 3.4); fillRR(g, tx - 46, 476, 92, 42, 20, hurt ? "#fff" : "#181a3a");
      g.save(); g.beginPath(); g.rect(tx - 46, 476, 92, 42); g.clip(); g.fillStyle = "#4b5390"; const off = (this.roll * 40) % 14; for (let k = -1; k < 8; k++) { g.fillRect(tx - 52 + k * 14 + off, 478, 6, 4); g.fillRect(tx - 52 + k * 14 + off, 512, 6, 4); } g.restore();
      for (const w of [-30, 0, 30]) { circle(g, tx + w, 497, 13, hurt ? "#fff" : "#8e96c4", OUT, 2.4); circle(g, tx + w, 497, 4, "#2a2d57"); g.save(); g.translate(tx + w, 497); g.rotate(this.roll * 2 * s + w); line(g, -9, 0, 9, 0, "#2a2d57", 3); g.restore(); }
    }
    // --- hull with hazard stripes
    g.save(); fillRR(g, bx - 98, 326, 196, 150, 20, hurt ? "#fff" : lin(g, 0, 326, 0, 476, [[0, yel], [1, yel2]]), OUT, 3.6);
    g.beginPath(); g.roundRect ? g.roundRect(bx - 98, 326, 196, 150, 20) : g.rect(bx - 98, 326, 196, 150); g.clip();
    g.fillStyle = "#1b1530"; for (let k = -2; k < 12; k++) { g.beginPath(); g.moveTo(bx - 100 + k * 26, 448); g.lineTo(bx - 82 + k * 26, 448); g.lineTo(bx - 100 + k * 26 + 12, 476); g.lineTo(bx - 118 + k * 26 + 12, 476); g.fill(); }
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(bx - 90, 332, 180, 6); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(bx - 98, 436, 196, 12);
    g.restore();
    for (const [rx, ry] of [[-80, 346], [80, 346], [-80, 424], [80, 424]]) { circle(g, bx + rx, ry, 5, hurt ? "#fff" : yel2, OUT, 1.8); }
    fillRR(g, bx + 28, 352, 56, 38, 8, "#1b1530", OUT, 2.6); for (let k = 0; k < 4; k++) line(g, bx + 34, 360 + k * 8, bx + 78, 360 + k * 8, "#4b5390", 2.4);
    // exhaust stack
    fillRR(g, bx + 62, 296, 18, 38, 5, metalD, OUT, 2.6);
    // --- tower
    fillRR(g, bx - 42, 168, 84, 170, 10, hurt ? "#fff" : lin(g, bx - 42, 0, bx + 42, 0, [[0, "#8a94d6"], [1, metalD]]), OUT, 3.4);
    g.save(); g.strokeStyle = "rgba(20,10,50,.55)"; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(bx - 34, 184 + k * 40); g.lineTo(bx + 34, 214 + k * 40); g.moveTo(bx + 34, 184 + k * 40); g.lineTo(bx - 34, 214 + k * 40); g.stroke(); } g.restore();
    // --- boom (a truss reaching over the street) and the counterweight
    const bl = this.x0 + 100;
    fillRR(g, bl, RAIL_Y - 32, bx - 40 - bl, 12, 4, metal, OUT, 2.6); fillRR(g, bl, RAIL_Y - 2, bx - 40 - bl, 14, 4, metalD, OUT, 2.6);
    g.save(); g.strokeStyle = hurt ? "#fff" : "#5b64a3"; g.lineWidth = 4; g.beginPath(); for (let x = bl + 16; x < bx - 60; x += 44) { g.moveTo(x, RAIL_Y - 20); g.lineTo(x + 22, RAIL_Y); g.lineTo(x + 44, RAIL_Y - 20); } g.stroke(); g.restore();
    fillRR(g, bl - 10, RAIL_Y - 36, 22, 54, 6, hurt ? "#fff" : yel, OUT, 3);
    fillRR(g, bx + 36, 164, 82, 52, 8, hurt ? "#fff" : "#2a2d57", OUT, 3.2); g.fillStyle = yel; g.fillRect(bx + 44, 176, 66, 8); g.fillRect(bx + 44, 196, 66, 8);
    // --- the cab (the weak spot)
    const exposed = this.low > 0.5 && !this.dead, pulse = 0.5 + 0.5 * Math.sin(t * 9);
    fillRR(g, bx - 40, c.y - 8, 16, 40, 4, metalD, OUT, 2.4);
    if (exposed) { g.save(); g.globalCompositeOperation = "lighter"; glow(g, c.x, c.y, 100, "#ffe27a", 0.45 + 0.3 * pulse); g.restore(); }
    fillRR(g, c.x - 54, c.y - 40, 108, 80, 26, hurt ? "#fff" : lin(g, 0, c.y - 40, 0, c.y + 40, [[0, "#5b64a3"], [1, "#2a2d57"]]), exposed ? "#ffe27a" : OUT, exposed ? 4.4 : 3.6);
    fillRR(g, c.x - 46, c.y - 30, 70, 50, 16, hurt ? "#fff" : lin(g, 0, c.y - 30, 0, c.y + 20, [[0, "#c9fffb"], [1, "#3ee6e0"]]), OUT, 2.6);
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(c.x - 38, c.y - 24, 24, 5);
    const ex = c.x - 22 + this.look * 8, ey = c.y - 6; circle(g, ex, ey, 17, "#1a1030", OUT, 2.4); circle(g, ex, ey, 11, "#ff3e5e"); circle(g, ex - 3, ey - 3, 3.4, "#fff");
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, ex, ey, 34, "#ff3e5e", 0.55 + 0.25 * pulse); g.restore();
    line(g, c.x + 20, c.y - 40, c.x + 20, c.y - 62, OUT, 5); circle(g, c.x + 20, c.y - 64, 5, Math.floor(t * 6) % 2 ? "#ff5a5a" : "#5a1020", OUT, 2);
    if (exposed) text(g, "HIT IT!", c.x, c.y - 76, { size: 15, color: "#ffe27a", align: "center", stroke: OUT, strokeW: 5, weight: 900, alpha: 0.7 + 0.3 * pulse });
    // --- trolley, cable and the ball
    const warn = (this.st === "slam" && this.sub === "track" && this.stT > 0.55) || (this.st === "sweep" && this.sub === "lower" && this.subT > 0.6);
    if (this.st === "slam" && this.sub === "track") groundMark(g, this.tx, FLOOR_Y, 64, this.stT / 1.0, t, "#ff4a6a");
    if (this.st === "sweep" && (this.sub === "lower" || this.sub === "run")) { g.save(); g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 20); g.fillStyle = "#ff4a6a"; g.fillRect(this.x0 + 60, FLOOR_Y - 6, 780, 6); g.restore(); }
    fillRR(g, this.tx - 28, RAIL_Y + 8, 56, 24, 7, hurt ? "#fff" : yel, OUT, 2.8); circle(g, this.tx - 16, RAIL_Y + 34, 6, "#2a2d57", OUT, 2); circle(g, this.tx + 16, RAIL_Y + 34, 6, "#2a2d57", OUT, 2);
    capsule(g, this.tx, RAIL_Y + 30, this.tx, this.by - BALL_R + 4, 3.4, "#2a2d57", OUT, 2); g.save(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.4; for (let y = RAIL_Y + 38; y < this.by - BALL_R; y += 12) { g.beginPath(); g.moveTo(this.tx - 3, y); g.lineTo(this.tx + 3, y + 4); g.stroke(); } g.restore();
    const spin = this.tx * 0.02;
    g.save(); g.translate(this.tx, this.by); g.rotate(spin);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; poly(g, [[Math.cos(a - 0.2) * BALL_R, Math.sin(a - 0.2) * BALL_R], [Math.cos(a) * (BALL_R + 11), Math.sin(a) * (BALL_R + 11)], [Math.cos(a + 0.2) * BALL_R, Math.sin(a + 0.2) * BALL_R]], hurt ? "#fff" : "#8e96c4", OUT, 2.2); }
    circle(g, 0, 0, BALL_R, hurt ? "#fff" : rad(g, -10, -10, 4, BALL_R + 4, [[0, "#9aa3d6"], [1, "#2a2d57"]]), OUT, 3.4);
    g.fillStyle = yel; g.fillRect(-BALL_R + 4, -5, BALL_R * 2 - 8, 10); g.fillStyle = "#1b1530"; for (let k = -3; k < 4; k++) { g.beginPath(); g.moveTo(k * 10 - 5, -5); g.lineTo(k * 10 + 1, -5); g.lineTo(k * 10 + 5, 5); g.lineTo(k * 10 - 1, 5); g.fill(); }
    circle(g, 0, -BALL_R + 4, 5, "#8e96c4", OUT, 2);
    if (warn && Math.floor(t * 14) % 2) { g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 60, "#ff3e5e", 0.7); }
    g.restore();
    g.restore();
  }
}
