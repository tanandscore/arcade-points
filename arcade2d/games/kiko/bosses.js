// Kiko Leap — the four boss fights. Every boss follows the same recipe:
//   dodge its attack -> it gets dizzy / lands -> stomp it (3 hits) -> it gets angrier each time.
import { clamp, sign, damp } from "../../core/util";
import { FX } from "../../core/fx";
import * as BA from "./bossart";

const FLOOR = 480; // top of the arena floor (row 10)

class Boss {
  constructor(name) { this.name = name; this.hp = 3; this.maxHp = 3; this.flash = 0; this.invT = 0; this.dead = false; this.dying = 0; this.st = 0; this.vulnerable = false; this.pose = "idle"; this.state = "idle"; this.face = -1; }
  get phase() { return 4 - this.hp; } // 1, 2, 3 = how angry it is
  go(state, pose) { this.state = state; this.st = 0; if (pose) this.pose = pose; }
  tick(dt, S) {
    this.flash = Math.max(0, this.flash - dt); this.invT = Math.max(0, this.invT - dt);
    if (this.dying > 0) {
      this.dying -= dt; this.vulnerable = false; this.st += dt;
      if (Math.random() < 0.45) { FX.explosion(S.fx, this.x + (Math.random() - 0.5) * 70, this.y - 30 + (Math.random() - 0.5) * 60, 0.45); S.sfx.explode(); }
      if (this.dying <= 0) { this.dead = true; S.sfx.boom(); FX.explosion(S.fx, this.x, this.y - 30, 1.9); FX.confetti(S.fx, this.x, this.y - 40, 50); S.cam.shake(16, 0.6); S.beginWin(); }
      return true;
    }
    this.st += dt; return false;
  }
  hit(S) {
    this.hp--; this.flash = 1.3; this.invT = 1.3; this.vulnerable = false;
    S.addScore(1000, this.x, this.y - 100, "#ffe27a", 26); S.sfx.stomp(); S.sfx.hurt(); S.cam.shake(12, 0.35); S.juice.hitstop(0.12); S.juice.doFlash(0.3, "#fff");
    FX.explosion(S.fx, this.x, this.y - 30, 0.8);
    if (this.hp <= 0) { this.dying = 2.1; this.pose = "dying"; S.juice.slowmo(0.8, 0.4); S.sfx.explode(); } else this.onHit(S);
  }
  draw(g, S, t) { /* set by subclass */ }
}

// ---------------------------------------------------------------- King Mudge ----------------------------------------------------------------
class Mudge extends Boss {
  constructor(e) { super("King Mudge"); this.x = e.x; this.y = e.y; this.w = 70; this.h = 62; this.go("idle", "idle"); }
  onHit(S) { this.go("hurt", "dizzy"); }
  update(dt, S) {
    if (this.tick(dt, S)) return;
    const H = S.hero, ph = this.phase, x0 = S.ax0 + this.w / 2 + 4, x1 = S.ax1 - this.w / 2 - 4;
    switch (this.state) {
      case "idle": { this.pose = "idle"; this.walk = true; const d = sign(H.x - this.x) || this.face; this.face = d; this.x = clamp(this.x + d * 50 * dt, x0, x1); if (this.st > 1.5 - 0.3 * (ph - 1)) { this.walk = false; this.go("windup", "windup"); S.sfx.alarm(); } break; }
      case "windup": { if (this.st < 0.05) this.face = sign(H.x - this.x) || this.face; if (this.st > 0.85) { this.go("charge", "charge"); S.sfx.whoosh(); } break; }
      case "charge": {
        this.x += this.face * (320 + 45 * ph) * dt; if (Math.random() < 0.8) FX.dust(S.fx, this.x - this.face * 34, this.y, 1);
        if (this.x <= x0 || this.x >= x1) this.crash(S, x0, x1); break;
      }
      case "dizzy": { this.vulnerable = true; if (this.st > 2.6) { this.vulnerable = false; this.go("idle", "idle"); } break; }
      case "hurt": { this.vulnerable = false; if (this.st > 1.4) this.go("idle", "idle"); break; }
    }
  }
  crash(S, x0, x1) {
    this.x = clamp(this.x, x0, x1); S.cam.shake(13, 0.45); S.sfx.thudStone(); S.sfx.explode();
    FX.debris(S.fx, this.x + this.face * 30, this.y - 20, ["#a4693f", "#5a3520", "#e2bd96"], 12, 1.2); FX.dust(S.fx, this.x + this.face * 30, this.y, 6);
    this.go("dizzy", "dizzy"); this.vulnerable = true;
    const n = this.phase >= 3 ? 5 : this.phase === 2 ? 3 : 0;
    for (let i = 0; i < n; i++) { const rx = S.ax0 + 70 + Math.random() * (S.ax1 - S.ax0 - 140); S.after(0.15 + i * 0.28, () => { S.mark(rx, 0.7); S.after(0.7, () => { S.projs.push({ kind: "rock", x: rx, y: -30, vx: 0, vy: 0, g: 1500, r: 17, life: 4, rot: 0 }); }); }); }
  }
  hitboxes() { return [{ x: this.x - this.w / 2 + 5, y: this.y - this.h, w: this.w - 10, h: this.h, harm: this.state === "idle" || this.state === "windup" || this.state === "charge" }]; }
  draw(g, S, t) { if (!this.dead) BA.drawMudge(g, { x: this.x, y: this.y, face: this.face, pose: this.pose, walk: this.walk, flash: this.flash }, t); }
}

// ---------------------------------------------------------------- Weavett ----------------------------------------------------------------
class Weavett extends Boss {
  constructor(e) { super("Weavett the Weaver"); this.x = e.x; this.homeY = 142; this.y = this.homeY; this.w = 62; this.h = 56; this.shot = 1; this.go("crawl", "crawl"); this.look = 0; }
  onHit(S) { this.go("hurt", "ground"); this.curled = true; this.vy = -300; }
  update(dt, S) {
    if (this.tick(dt, S)) return;
    const H = S.hero, ph = this.phase, x0 = S.ax0 + 50, x1 = S.ax1 - 50; this.look = sign(H.x - this.x);
    switch (this.state) {
      case "crawl": {
        this.pose = "crawl"; this.curled = false; this.x = clamp(this.x + sign(H.x - this.x) * (115 + 25 * ph) * dt, x0, x1); this.y = this.homeY + Math.sin(this.st * 5) * 3;
        if (ph >= 2) { this.shot -= dt; if (this.shot <= 0) { this.shot = 1.7; S.fire(this.x, this.y + 26, H.x, H.y - 20, 250, "web", 12); S.sfx.pop(); } }
        if (this.st > 2.5 - 0.3 * (ph - 1)) { this.go("warn", "warn"); this.tx = clamp(H.x, x0, x1); S.sfx.alarm(); S.mark(this.tx, 0.85); }
        break;
      }
      case "warn": { this.x = damp(this.x, this.tx, 9, dt); this.y = this.homeY - 6 * Math.min(1, this.st * 3); if (this.st > 0.85) { this.go("drop", "crawl"); this.vy = 0; this.x = this.tx; S.sfx.whoosh(); } break; }
      case "drop": { this.vy += 2800 * dt; this.y += this.vy * dt; if (this.y >= FLOOR - 30) { this.y = FLOOR - 30; this.land(S); } break; }
      case "ground": { this.pose = "ground"; this.curled = true; this.vulnerable = true; if (this.st > 2.1 - 0.2 * (ph - 1)) { this.vulnerable = false; this.go("climb", "crawl"); this.curled = false; } break; }
      case "climb": { this.y -= 540 * dt; if (this.y <= this.homeY) { this.y = this.homeY; this.go("crawl", "crawl"); } break; }
      case "hurt": { this.vulnerable = false; this.vy = (this.vy || 0) + 1600 * dt; this.y = Math.min(FLOOR - 30, this.y + this.vy * dt); if (this.st > 1.2) { this.go("climb", "crawl"); this.curled = false; } break; }
    }
  }
  land(S) {
    const ph = this.phase; S.cam.shake(12, 0.4); S.sfx.thudStone(); S.sfx.explode(); FX.dust(S.fx, this.x - 24, FLOOR, 6); FX.dust(S.fx, this.x + 24, FLOOR, 6); FX.debris(S.fx, this.x, FLOOR - 6, ["#9a6bff", "#5b34b0"], 8, 0.8);
    if (ph >= 2) for (const s of [-1, 1]) S.projs.push({ kind: "web", roll: true, x: this.x + s * 40, y: FLOOR - 12, vx: s * 235, vy: 0, g: 0, r: 12, life: 4, rot: 0 });
    if (ph >= 3) { S.spawnEnemy("x", this.x - 90, FLOOR); S.spawnEnemy("x", this.x + 90, FLOOR); }
    this.go("ground", "ground"); this.curled = true; this.vulnerable = true;
  }
  hitboxes() { return [{ x: this.x - 30, y: this.y - 28, w: 60, h: 54, harm: true }]; }
  draw(g, S, t) {
    if (this.dead) return;
    g.save(); g.strokeStyle = "rgba(240,236,255,.75)"; g.lineWidth = 3; g.beginPath(); g.moveTo(this.x, 96); g.lineTo(this.x, this.y - 30); g.stroke(); g.restore();
    BA.drawWeavett(g, { x: this.x, y: this.y, pose: this.pose, curled: this.curled, look: this.look, flash: this.flash }, t);
  }
}

// ---------------------------------------------------------------- Queen Nimbra ----------------------------------------------------------------
class Nimbra extends Boss {
  constructor(e) { super("Queen Nimbra"); this.x = e.x; this.y = e.y; this.baseY = 205; this.w = 80; this.h = 62; this.cycle = 0; this.go("float", "float"); this.look = 0; }
  onHit(S) { this.go("hurt", "stunned"); }
  update(dt, S) {
    if (this.tick(dt, S)) return;
    const H = S.hero, ph = this.phase, cx = S.map.w / 2; this.look = sign(H.x - this.x);
    switch (this.state) {
      case "float": {
        this.pose = "float"; this.x = damp(this.x, cx + Math.sin(this.st * 1.25 + 1) * 300, 2.4, dt); this.y = damp(this.y, this.baseY + Math.sin(this.st * 2.3) * 16, 4, dt);
        if (this.st > 2.1 - 0.2 * (ph - 1)) { this.cycle++; if (this.cycle % 3 === 0) this.go("swoopWind", "rear"); else this.go("rear", "rear"); }
        break;
      }
      case "rear": { if (this.st > 0.6) { this.go("bolts", "bolts"); this.strike(S); } break; }
      case "bolts": { if (this.st > 1.15) this.go("float", "float"); break; }
      case "swoopWind": { this.y = damp(this.y, this.baseY - 30, 6, dt); if (this.st > 0.75) { this.go("swoop", "bolts"); this.tx = clamp(H.x, S.ax0 + 50, S.ax1 - 50); this.ty = FLOOR - 34; S.mark(this.tx, 0.5); S.sfx.whoosh(); } break; }
      case "swoop": {
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy), sp = 780 + 60 * ph;
        if (d < sp * dt + 2) { this.x = this.tx; this.y = this.ty; S.cam.shake(14, 0.45); S.sfx.thudStone(); S.sfx.explode(); FX.dust(S.fx, this.x - 30, FLOOR, 6); FX.dust(S.fx, this.x + 30, FLOOR, 6); FX.debris(S.fx, this.x, FLOOR - 8, ["#6a4fb0", "#b8a6ff"], 8, 0.8); this.go("stunned", "stunned"); this.vulnerable = true; }
        else { this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt; if (Math.random() < 0.6) FX.sparks(S.fx, this.x, this.y, 2, "#ffe27a"); }
        break;
      }
      case "stunned": { this.vulnerable = true; if (this.st > 2.3) { this.vulnerable = false; this.go("recover", "float"); } break; }
      case "recover": { this.y -= 280 * dt; if (this.y <= this.baseY) { this.y = this.baseY; this.go("float", "float"); } break; }
      case "hurt": { this.vulnerable = false; this.y = Math.max(this.baseY, this.y - 120 * dt); if (this.st > 1.3) this.go("float", "float"); break; }
    }
  }
  strike(S) {
    const H = S.hero, ph = this.phase, xs = [H.x]; if (ph >= 2) xs.push(H.x - 150, H.x + 150); if (ph >= 3) xs.push(H.x - 300, H.x + 300);
    for (const raw of xs) {
      const x = clamp(raw, S.ax0 + 30, S.ax1 - 30); S.mark(x, 0.9);
      S.after(0.9, () => { S.projs.push({ kind: "bolt", x, floor: FLOOR, armed: true, life: 0.32, vx: 0, vy: 0, r: 0 }); S.sfx.explode(); S.cam.shake(5, 0.2); });
    }
    S.sfx.alarm();
  }
  hitboxes() { return [{ x: this.x - 36, y: this.y - 30, w: 72, h: 58, harm: true }]; }
  draw(g, S, t) { if (!this.dead) BA.drawNimbra(g, { x: this.x, y: this.y, pose: this.pose, look: this.look, flash: this.flash }, t); }
}

// ---------------------------------------------------------------- Ignar ----------------------------------------------------------------
class Ignar extends Boss {
  constructor(e) { super("Ignar the Magma Golem"); this.x = e.x; this.y = e.y; this.w = 84; this.h = 110; this.cycle = 0; this.volleyN = 0; this.go("walk", "walk"); }
  onHit(S) { this.go("hurt", "kneel"); }
  update(dt, S) {
    if (this.tick(dt, S)) return;
    const H = S.hero, ph = this.phase, x0 = S.ax0 + 54, x1 = S.ax1 - 54;
    switch (this.state) {
      case "walk": {
        this.pose = "walk"; const d = sign(H.x - this.x) || this.face; this.face = d; const before = Math.sin(this.st * 7); this.x = clamp(this.x + d * (52 + 10 * ph) * dt, x0, x1);
        if (before > 0 && Math.sin((this.st + dt) * 7) <= 0) { S.cam.shake(2.5, 0.1); S.sfx.thudStone(); }
        if (this.st > 1.6 - 0.2 * (ph - 1)) { this.cycle++; this.volleyN = 0; if (this.cycle % 2) this.go("volley", "idle"); else this.go("windup", "windup"); }
        break;
      }
      case "volley": { const n = 2 + ph; if (this.volleyN < n && this.st > 0.45 + this.volleyN * 0.45) { this.volleyN++; this.lob(S); } if (this.volleyN >= n && this.st > 0.45 + n * 0.45 + 0.6) this.go("walk", "walk"); break; }
      case "windup": { this.face = sign(H.x - this.x) || this.face; if (this.st > 0.8) { this.slam(S); this.go("slam", "slam"); } break; }
      case "slam": { if (this.st > 0.5) { this.go("kneel", "kneel"); this.vulnerable = true; } break; }
      case "kneel": { this.vulnerable = true; if (this.st > 2.7) { this.vulnerable = false; this.go("walk", "walk"); } break; }
      case "hurt": { this.vulnerable = false; if (this.st > 1.3) this.go("walk", "walk"); break; }
    }
  }
  lob(S) {
    const H = S.hero, sx = this.x + this.face * 30, sy = this.y - 102, tx = clamp(H.x + (Math.random() - 0.5) * 140, S.ax0 + 30, S.ax1 - 30), ty = FLOOR - 8, T = 0.95, g = 1400;
    S.projs.push({ kind: "lava", x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T, g, r: 13, life: 3, rot: 0 }); S.mark(tx, T); S.sfx.rocket();
  }
  slam(S) {
    const ph = this.phase, sp = 285 + 45 * ph; S.cam.shake(15, 0.5); S.sfx.boom(); FX.dust(S.fx, this.x - 50, FLOOR, 6); FX.dust(S.fx, this.x + 50, FLOOR, 6); FX.debris(S.fx, this.x, FLOOR - 10, ["#6a4a52", "#ff8a2a"], 10, 1);
    const pairs = ph >= 3 ? 3 : ph >= 2 ? 2 : 1;
    for (let k = 0; k < pairs; k++) S.after(k * 0.62, () => { for (const s of [-1, 1]) S.projs.push({ kind: "wave", x: this.x + s * 54, y: FLOOR, vx: s * sp, vy: 0, life: 6, r: 0 }); S.sfx.crackStone(); });
  }
  hitboxes() { const k = this.state === "kneel"; return [{ x: this.x - 40, y: this.y - (k ? 84 : 108), w: 80, h: k ? 84 : 108, harm: this.state !== "hurt" && !this.vulnerable }]; }
  draw(g, S, t) { if (!this.dead) BA.drawIgnar(g, { x: this.x, y: this.y, face: this.face, pose: this.pose, flash: this.flash }, t); }
}

export function makeBoss(kind, ent) {
  switch (kind) { case "mole": return new Mudge(ent); case "spider": return new Weavett(ent); case "storm": return new Nimbra(ent); default: return new Ignar(ent); }
}
