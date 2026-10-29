// Boss 3 — the Forge Titan (Foundry Row). A walking furnace.
// It spits a stream of fire, lobs fireballs that leave burning puddles, and stomps shock waves along the floor.
// Weak point: the furnace door in its chest. Its armour shrugs off almost everything, but the door swings open
// while it breathes fire and when it staggers after a stomp. Platforms keep you above flames and shock waves.
import { Boss, FLOOR_Y, drawFlames, shadow } from "./base";
import { clamp, TAU, lerp, damp } from "../../../core/util";
import { FX } from "../../../core/fx";
import { circle, ellipse, fillRR, poly, line, capsule, glow, lin, rad, text, OUT } from "../../../core/draw";

export class Titan extends Boss {
  constructor(S, spawn) {
    super(S, spawn, { name: "Forge Titan", hp: 380, keepAway: 330, phases: [0.5, 0.2], hint: "Its armour is tough. Shoot the glowing furnace door when it swings open!" });
    this.x = this.x0 + 790; this.face = -1; this.open = 0; this.arm = 0; this.walk = 0; this.vel = 0; this.cool = 1.0; this.sub = ""; this.si = 0; this.made = 0; this.lobs = [];
    this.seq = ["flame", "lob", "stomp", "flame", "stomp", "lob"]; this.la = 0.5; this.laT = 0.5; this.emitT = 0; this.hot = 0;
  }

  boxes() {
    const f = this.face, x = this.x, door = this.open > 0.5;
    return [
      { x: f < 0 ? x - 82 : x - 10, y: FLOOR_Y - 210, w: 92, h: 190, mul: door ? 3.2 : 0.25, weak: 3.2 },   // the furnace door, on the front of the chest (flat shots from the street, a catwalk or a jump all find it)
      { x: x + f * 26 - 32, y: FLOOR_Y - 338, w: 64, h: 58, mul: 0.9 },                   // the head
      { x: x - 80, y: FLOOR_Y - 272, w: 160, h: 272, mul: 0.25 },                         // thick armour
    ];
  }
  aimPoint() { return { x: this.x + this.face * 36, y: FLOOR_Y - 130 }; }
  deflect(S, p) { if (p) { FX.sparks(S.fx, p.x, p.y, 4, "#ffe9a8"); } }

  // the flame arm swings to point at you; "la" is its angle in the Titan's own (mirrored) frame
  projectiles() { return this.lobs.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, g: 900, r: 28, dmg: 15 })); }
  mouth() { const la = this.la; return { x: this.x + this.face * (64 + 80 * Math.cos(la)), y: FLOOR_Y - 238 + 80 * Math.sin(la) }; }
  worldAngle() { return Math.atan2(Math.sin(this.la), this.face * Math.cos(this.la)); }

  think(S, dt) {
    const H = S.hero, ph = this.phase, sp = ph >= 2 ? 1.3 : 1, committed = this.st === "stomp" || this.st === "flame" || this.st === "stagger";
    if (!committed && this.st !== "intro") this.face = H.x < this.x ? -1 : 1;
    this.open = damp(this.open, this.st === "flame" || this.st === "stagger" ? 1 : this.st === "intro" ? 0.4 + 0.4 * Math.sin(this.t * 14) : 0, 9, dt);
    this.arm = damp(this.arm, (this.st === "stomp" && this.stT < 0.85) || (this.st === "lob" && this.stT < 0.6) ? 1 : 0, 8, dt);
    this.hot = damp(this.hot, this.st === "flame" || this.st === "stagger" ? 1 : 0, 5, dt);
    if (Math.random() < dt * 8) FX.smoke(S.fx, this.x - this.face * 60, FLOOR_Y - 300, 8);
    if (this.st === "flame" && this.stT < 0.9) { const a = Math.atan2(H.y - 26 - (FLOOR_Y - 238), H.x - (this.x + this.face * 64)); this.laT = clamp(Math.atan2(Math.sin(a), this.face * Math.cos(a)), -0.5, 1.15); } else if (this.st !== "flame") this.laT = 0.5;
    this.la = damp(this.la, this.laT, 10, dt);
    this.updateLobs(S, dt, ph);
    // touching the Titan hurts
    if (!S.hero.dead && Math.abs(H.x - this.x) < 80 + H.w / 2 && H.y > FLOOR_Y - 250) S.hurtHero(14 * S.info.dmgMul, this.x, "blast");
    switch (this.st) {
      case "intro":
        this.vel = 0; if (this.stT > 1.7) { this.invuln = false; this.go("idle"); if (this.hint) S.showTip(this.hint, 4.5); }
        break;
      case "idle": {
        const dx = H.x - this.x, dist = Math.abs(dx), want = dist > 410 ? Math.sign(dx) * 58 * sp : dist < 250 ? -Math.sign(dx) * 70 * sp : 0;
        this.vel = damp(this.vel, want, 4, dt); this.x = clamp(this.x + this.vel * dt, this.x0 + 650, this.x1 - 110); this.walk += Math.abs(this.vel) * dt * 0.06;
        this.cool -= dt; if (this.cool <= 0) this.start(S, this.seq[this.si++ % this.seq.length]);
        break;
      }
      case "flame": this.flame(S, dt, ph); break;
      case "lob": {
        const n = ph >= 3 ? 5 : ph >= 2 ? 4 : 3;
        while (this.made < n && this.stT >= 0.55 + this.made * 0.3) { this.lob(S, this.made, n); this.made++; }
        if (this.stT > 0.55 + n * 0.3 + 1.1) { this.cool = ph >= 3 ? 0.5 : 1.0; this.go("idle"); }
        break;
      }
      case "stomp":
        if (this.stT >= 0.85 && !this.sub) { this.sub = "hit"; this.stomp(S, ph); }
        if (this.stT >= 0.85 + 0.05 && this.sub === "hit") { this.sub = ""; this.go("stagger"); }
        break;
      case "stagger":    // dazed after the stomp, the furnace door hangs open: shoot it!
        if (this.stT > (ph >= 3 ? 2.2 : 2.8)) { this.cool = 0.6; this.go("idle"); }
        break;
      default: break;
    }
  }

  start(S, a) {
    this.go(a); this.sub = ""; this.made = 0; this.emitT = 0;
    if (a === "flame" || a === "stomp") S.sfx.alarm();
    if (a === "flame") { const ph = this.phase, dur = ph >= 3 ? 2.2 : ph >= 2 ? 1.8 : 1.5; this.jet = this.addHaz({ kind: "beam", x: 0, y: 0, x2: 0, y2: 0, w: 30, delay: 0.9, life: dur + 0.1, dmg: 0, always: true, draw: () => {} }); }   // (only so the autopilot can see where the stream goes)
    if (a === "lob") S.sfx.whoosh();
  }

  // ---- fire breath: a stream of fireballs out of the furnace. Duck behind... no, jump up onto a platform!
  flame(S, dt, ph) {
    const tele = 0.9, dur = ph >= 3 ? 2.2 : ph >= 2 ? 1.8 : 1.5, m = this.mouth();
    if (this.jet) { const wa = this.worldAngle(); this.jet.x = m.x; this.jet.y = m.y; this.jet.x2 = m.x + Math.cos(wa) * 350; this.jet.y2 = m.y + Math.sin(wa) * 350; }
    if (this.stT < tele) return;                 // the arm is still swinging round to point at you
    const t = this.stT - tele;
    if (t < dur) {
      this.emitT -= dt;
      while (this.emitT <= 0) {
        this.emitT += 0.055; const a = this.worldAngle() + Math.sin(t * 2.4) * 0.08;
        this.shoot(S, m.x, m.y, a, 430, 9, "fire", "#ff7a2d", { life: 0.8, r: 10 });
      }
      if (Math.random() < dt * 20) S.sfx.whoosh();
      S.cam.shake(2, 0.1);
    } else if (t > dur + 1.0) { this.cool = ph >= 3 ? 0.5 : 1.0; this.go("idle"); }
  }
  // ---- fireballs in a high arc; each leaves a burning puddle
  lob(S, i, n) {
    const H = S.hero, from = { x: this.x + this.face * 40, y: FLOOR_Y - 262 }, offs = [0, -200, 200, -400, 400], tx = clamp(H.x + offs[i % offs.length] * (i === 0 ? 0 : 1) + (Math.random() - 0.5) * 40, this.x0 + 90, this.x1 - 90);
    const T = 1.0, g = 900, ty = FLOOR_Y - 12;
    this.addHaz({ kind: "mark", x: tx, r: 52, delay: T, life: 0.02, dmg: 0, color: "#ff7a2d", warn: true });     // where it will land
    this.lobs.push({ x: from.x, y: from.y, vx: (tx - from.x) / T, vy: (ty - from.y - 0.5 * g * T * T) / T, age: 0 });
    S.sfx.rocket(); FX.sparks(S.fx, from.x, from.y, 6, "#ffb36b");
  }
  updateLobs(S, dt, ph) {
    const H = S.hero;
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const b = this.lobs[i]; b.age += dt; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.random() < dt * 40) FX.sparks(S.fx, b.x, b.y, 1, "#ffb36b");
      let boom = b.y >= FLOOR_Y - 10 || b.x < this.x0 + 40 || b.x > this.x1 - 40;
      if (!boom && !H.dead && !this.dead && Math.hypot(b.x - H.x, b.y - (H.y - 28)) < 40) { S.hurtHero(15 * S.info.dmgMul, b.x, "blast"); boom = true; }
      if (this.dead) boom = true;
      if (boom) { this.lobs.splice(i, 1); if (!this.dead) this.puddle(S, clamp(b.x, this.x0 + 70, this.x1 - 70), ph >= 2 ? 5.5 : 4); }
    }
  }
  puddle(S, x, life) {
    S.sfx.explode(); FX.explosion(S.fx, x, FLOOR_Y - 12, 0.7); S.cam.shake(4, 0.2);
    this.addHaz({ kind: "rect", x: x - 46, y: FLOOR_Y - 26, w: 92, h: 26, delay: 0, life, dmg: 9, hurt: "melee", draw: (g, z, t) => drawFlames(g, z, t, Math.min(1, (z.life - z.age) / 0.8, z.age / 0.15 + 0.2)) });
  }
  // ---- the stomp: shock waves run along the floor
  stomp(S, ph) {
    S.cam.shake(13, 0.55); S.sfx.boom(); FX.dust(S.fx, this.x, FLOOR_Y, 18); FX.debris(S.fx, this.x, FLOOR_Y - 8, ["#4b3a66", "#2a1f3d", "#ff7a2d"], 12, 1.3);
    const sp = ph >= 2 ? 400 : 340, rounds = ph >= 2 ? 2 : 1;
    for (let r = 0; r < rounds; r++) for (const d of [-1, 1]) this.addHaz({ kind: "wave", x: this.x - 23 + d * 70, y: FLOOR_Y - 36, w: 46, h: 36, vx: d * sp, delay: r * 0.5, life: 4, dmg: 20, tick: (z, dt2) => { if (Math.random() < dt2 * 16) FX.dust(S.fx, z.x + z.w / 2, FLOOR_Y, 2); } });
    if (ph >= 2) for (const d of [-1, 1]) this.puddle(S, clamp(this.x + d * 230, this.x0 + 80, this.x1 - 80), 5);
  }
  enterPhase(S, n) {
    super.enterPhase(S);
    if (n === 2) { S.showTip("The furnace is blazing! Fireballs leave burning ground.", 3.2); S.say("It's getting hot in here.", 2.2, true); }
    else { S.showTip("RAGE! It is attacking non-stop. Finish it!", 3.2); S.say("Almost there!", 2, true); }
    this.bonus(S, "med"); this.bonus(S, "ammo"); FX.explosion(S.fx, this.x, FLOOR_Y - 190, 1.3);
  }
  updateDead(S, dt) {
    this.open = damp(this.open, 1, 6, dt); this.lobs.length = 0;
    if (this.deadT < 2.2 && Math.random() < dt * 18) FX.explosion(S.fx, this.x - 70 + Math.random() * 140, FLOOR_Y - 20 - Math.random() * 280, 0.8);
  }

  // ------------------------------------------------------------------------------------------------------------------ drawing
  drawBody(g, S, t) {
    const hurt = this.flash > 0, alpha = this.fade(), f = this.face, x = this.x; if (alpha <= 0.01) return;
    const iron = hurt ? "#ffffff" : "#4d3b6b", iron2 = hurt ? "#ffffff" : "#2c2143", rust = hurt ? "#ffffff" : "#8a4a2a", pulse = 0.5 + 0.5 * Math.sin(t * 9);
    const sink = this.dead ? Math.min(46, this.deadT * 22) : 0, lift = (this.st === "stomp" && this.stT < 0.85) ? Math.sin(Math.min(1, this.stT / 0.85) * Math.PI * 0.5) * 16 : 0;
    g.save(); g.globalAlpha = alpha; shadow(g, x, FLOOR_Y - 1, 130, 0.38);
    g.translate(x, FLOOR_Y + sink); g.scale(f, 1);
    // back arm and fist (raised for the stomp)
    const raise = this.arm, fistY = lerp(-118, -330, raise), fistX = lerp(-92, -64, raise);
    capsule(g, -60, -238, fistX, fistY, 17, iron, OUT, 3); circle(g, fistX, fistY, 28, rust, OUT, 3.4); circle(g, fistX - 4, fistY - 5, 8, "rgba(255,255,255,.25)");
    // legs
    for (const s of [-1, 1]) { const ph = this.walk + (s > 0 ? Math.PI : 0), up = Math.max(0, Math.sin(ph)) * 10 + (s > 0 ? lift : 0); capsule(g, s * 36, -100, s * 36, -22 - up, 22, iron2, OUT, 3.4); fillRR(g, s * 36 - 34, -24 - up, 70, 24, 9, iron, OUT, 3); }
    // torso
    fillRR(g, -82, -272, 164, 186, 30, hurt ? "#fff" : lin(g, 0, -272, 0, -86, [[0, "#5c4880"], [1, iron2]]), OUT, 3.8);
    g.save(); g.beginPath(); if (g.roundRect) g.roundRect(-82, -272, 164, 186, 30); else g.rect(-82, -272, 164, 186); g.clip();
    g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(-82, -118, 164, 32); g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(-72, -262, 18, 170);
    g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,122,45,${0.35 + 0.35 * this.hot})`; for (const yy of [-250, -122, -104]) g.fillRect(-82, yy, 164, 3);
    g.restore();
    for (const [rx, ry] of [[-62, -250], [62, -250], [-62, -110], [62, -110]]) circle(g, rx, ry, 5, rust, OUT, 1.8);
    // smokestacks on the back
    for (const sx of [-70, -50]) { fillRR(g, sx - 9, -318, 18, 54, 5, iron2, OUT, 2.6); fillRR(g, sx - 11, -322, 22, 8, 3, rust, OUT, 2); }
    // the furnace door in the chest
    const dc = { x: 16, y: -150 }, o = this.open;
    circle(g, dc.x, dc.y, 54, iron2, OUT, 4); g.save(); g.beginPath(); g.arc(dc.x, dc.y, 46, 0, TAU); g.clip();
    g.fillStyle = rad(g, dc.x, dc.y, 4, 48, [[0, "#fff3b8"], [0.5, "#ffb703"], [1, "#e0481c"]]); g.fillRect(dc.x - 50, dc.y - 50, 100, 100);
    g.globalCompositeOperation = "lighter"; glow(g, dc.x, dc.y, 70, "#ff7a2d", 0.25 + 0.6 * this.hot); g.globalCompositeOperation = "source-over";
    const slide = o * 48; fillRR(g, dc.x - 48 - slide, dc.y - 48, 50, 96, 4, iron, OUT, 3); fillRR(g, dc.x - 2 + slide, dc.y - 48, 50, 96, 4, iron, OUT, 3);
    g.fillStyle = "rgba(255,122,45,.8)"; g.fillRect(dc.x - 3 - slide * 0.0, dc.y - 40, 6, 80 * (1 - o)); g.restore();
    if (o > 0.5 && !this.dead) { g.save(); g.scale(f, 1); text(g, "HIT IT!", f * dc.x, dc.y - 66, { size: 14, color: "#ffe27a", align: "center", stroke: OUT, strokeW: 5, weight: 900, alpha: 0.7 + 0.3 * pulse }); g.restore(); }   // (undo the mirror so the words read the right way round)
    // head
    fillRR(g, -6, -342, 70, 58, 22, iron, OUT, 3.6); fillRR(g, 24, -322, 36, 14, 6, "#1a1030", OUT, 2.6); fillRR(g, 28, -319, 28, 8, 4, this.st === "flame" || this.st === "intro" ? "#fff3b8" : "#ffb703");
    g.save(); g.globalCompositeOperation = "lighter"; glow(g, 42, -315, 36, "#ffb703", 0.35 + 0.3 * pulse); g.restore();
    poly(g, [[6, -338], [-4, -362], [20, -342]], rust, OUT, 2.6); poly(g, [[46, -338], [56, -362], [34, -342]], rust, OUT, 2.6);
    // shoulders
    for (const sx of [-62, 62]) { circle(g, sx, -246, 32, hurt ? "#fff" : rust, OUT, 3.6); circle(g, sx - 6, -254, 9, "rgba(255,255,255,.22)"); }
    // front arm with the flame nozzle
    g.save(); g.translate(64, -238); g.rotate(this.la); capsule(g, 0, 0, 52, 0, 16, iron, OUT, 3); fillRR(g, 40, -13, 40, 26, 7, rust, OUT, 3); fillRR(g, 74, -9, 14, 18, 3, "#1a1030", OUT, 2.4);
    if (this.st === "flame") { g.globalCompositeOperation = "lighter"; glow(g, 88, 0, 18 + (this.stT < 0.9 ? 26 * (this.stT / 0.9) : 30), "#ff7a2d", 0.65); }
    g.restore();
    g.restore();
  }
}
