// Particles, camera and floating text: the "juice" that makes hits, jumps and pickups feel good.
import { TAU, clamp, lerp, damp, rng } from "./util";
import { starPath, text, FONT_DISPLAY } from "./draw";

const R = rng(99);

export class Particles {
  constructor(max = 700) { this.max = max; this.list = []; }
  clear() { this.list.length = 0; }
  emit(o) {
    if (this.list.length >= this.max) this.list.shift();
    const life = o.life ?? 0.6;
    this.list.push({ x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, life, max: life, size: o.size ?? 4, size2: o.size2 ?? 0, color: o.color || "#fff", shape: o.shape || "circle", g: o.g ?? 0, drag: o.drag ?? 0, rot: o.rot || 0, vr: o.vr || 0, glow: !!o.glow, a: o.a ?? 1, grow: o.grow || 0, bounce: o.bounce || 0, floor: o.floor });
  }
  // n particles flying out of a point
  burst(x, y, n, o = {}) {
    const { speed = [60, 220], angle = [0, TAU], size = [2, 5], life = [0.35, 0.8], color = "#fff", colors = null, g = 600, shape = "circle", drag = 0.5, glow = false, size2 = 0, vr = 0 } = o;
    for (let i = 0; i < n; i++) {
      const a = lerp(angle[0], angle[1], Math.random()), sp = lerp(speed[0], speed[1], Math.random());
      this.emit({ x: x + (o.jx ? (Math.random() - 0.5) * o.jx : 0), y: y + (o.jy ? (Math.random() - 0.5) * o.jy : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: lerp(size[0], size[1], Math.random()), size2, life: lerp(life[0], life[1], Math.random()), color: colors ? colors[(Math.random() * colors.length) | 0] : color, g, shape, drag, glow, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * (vr || 10), bounce: o.bounce, floor: o.floor });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.g * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= 0.7; if (Math.abs(p.vy) < 20) p.vy = 0; }
    }
  }
  draw(g) {
    for (const p of this.list) {
      const t = p.life / p.max, k = 1 - t, size = lerp(p.size, p.size2 || p.size * (p.shape === "smoke" ? 2.2 : 0.4), k) + p.grow * k;
      g.globalAlpha = clamp(t * 1.4, 0, 1) * p.a;
      if (p.glow) g.globalCompositeOperation = "lighter";
      g.fillStyle = p.color; g.strokeStyle = p.color;
      switch (p.shape) {
        case "square": g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-size / 2, -size / 2, size, size); g.restore(); break;
        case "spark": { const sp = Math.hypot(p.vx, p.vy) || 1; g.lineWidth = Math.max(1, size * 0.6); g.lineCap = "round"; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / sp) * size * 3, p.y - (p.vy / sp) * size * 3); g.stroke(); break; }
        case "ring": g.lineWidth = Math.max(1, 3 * t); g.beginPath(); g.arc(p.x, p.y, Math.max(1, size + p.grow * k), 0, TAU); g.stroke(); break;
        case "star": g.save(); g.translate(p.x, p.y); g.rotate(p.rot); starPath(g, 0, 0, size, 4, 0.4); g.fill(); g.restore(); break;
        case "confetti": g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.abs(Math.sin(p.rot * 3)) * 0.9 + 0.1); g.fillRect(-size / 2, -size / 3, size, size * 0.66); g.restore(); break;
        default: g.beginPath(); g.arc(p.x, p.y, Math.max(0.3, size), 0, TAU); g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  }
}

// ready-made effects ------------------------------------------------------------------------------------------------------------
export const FX = {
  dust(p, x, y, n = 5, color = "rgba(235,225,255,.8)") { p.burst(x, y, n, { speed: [20, 90], angle: [Math.PI, TAU], size: [2, 5], life: [0.25, 0.5], color, g: -30, drag: 3, shape: "smoke" }); },
  pop(p, x, y, color = "#ffc233", n = 10) { p.burst(x, y, n, { speed: [90, 260], size: [2, 5], life: [0.3, 0.7], color, g: 500, shape: "circle" }); p.emit({ x, y, size: 6, life: 0.3, color: "#fff", shape: "ring", grow: 26 }); },
  sparks(p, x, y, n = 8, color = "#ffe9a8") { p.burst(x, y, n, { speed: [120, 380], size: [1.5, 3], life: [0.15, 0.4], color, g: 300, shape: "spark", drag: 1, glow: true }); },
  explosion(p, x, y, s = 1) {
    p.emit({ x, y, size: 10 * s, life: 0.32, color: "#fff7d6", shape: "circle", size2: 70 * s, glow: true, a: 0.9 });
    p.emit({ x, y, size: 8 * s, life: 0.45, color: "#ffb703", shape: "ring", grow: 80 * s });
    p.burst(x, y, Math.round(14 * s), { speed: [60 * s, 380 * s], size: [4 * s, 10 * s], life: [0.4, 0.9], colors: ["#ff7a2d", "#ffb703", "#ff3e3e", "#fff1b8"], g: -40, drag: 2.4, shape: "smoke", glow: true });
    p.burst(x, y, Math.round(10 * s), { speed: [120 * s, 520 * s], size: [1.5, 3.5], life: [0.25, 0.7], color: "#ffe9a8", g: 700, shape: "spark", drag: 0.8, glow: true });
    p.burst(x, y, Math.round(8 * s), { speed: [40, 200 * s], size: [6 * s, 13 * s], life: [0.7, 1.4], color: "rgba(50,40,60,.7)", g: -60, drag: 1.4, shape: "smoke", angle: [Math.PI, TAU] });
  },
  debris(p, x, y, colors, n = 10, force = 1) { p.burst(x, y, n, { speed: [60 * force, 300 * force], size: [3, 7], life: [0.5, 1.1], colors, g: 900, shape: "square", drag: 0.3, vr: 18, angle: [Math.PI * 1.1, Math.PI * 1.9], bounce: 0.35 }); },
  confetti(p, x, y, n = 40) { p.burst(x, y, n, { speed: [120, 420], angle: [-Math.PI * 0.95, -Math.PI * 0.05], size: [5, 9], life: [1.0, 1.9], colors: ["#ffc233", "#ff3ea5", "#3ee6e0", "#7c5cff", "#7dff6a"], g: 520, shape: "confetti", drag: 1.1, vr: 16 }); },
  sparkle(p, x, y, color = "#fff6c4") { p.emit({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, size: 4 + Math.random() * 3, life: 0.5, color, shape: "star", vr: 6, glow: true }); },
  smoke(p, x, y, size = 6) { p.emit({ x, y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20, size, life: 0.8 + Math.random() * 0.4, color: "rgba(120,110,140,.6)", shape: "smoke", drag: 1 }); },
};

// ---- floating score / damage numbers --------------------------------------------------------------------------------------------
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, str, color = "#fff", size = 18, o = {}) { this.list.push({ x, y, str: String(str), color, size, t: 0, life: o.life ?? 0.9, vy: o.vy ?? -46, pop: o.pop ?? 1 }); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const f = this.list[i]; f.t += dt; f.y += f.vy * dt; f.vy *= 1 - 1.6 * dt; if (f.t >= f.life) this.list.splice(i, 1); } }
  draw(g) {
    for (const f of this.list) {
      const t = f.t / f.life, s = f.size * (t < 0.12 ? 0.6 + (t / 0.12) * 0.55 * f.pop : 1.15 - 0.15 * Math.min(1, (t - 0.12) * 6));
      text(g, f.str, f.x, f.y, { size: s, color: f.color, align: "center", stroke: "#150a33", strokeW: 4, font: FONT_DISPLAY, weight: 800, alpha: clamp(1.6 * (1 - t), 0, 1) });
    }
  }
}

// ---- camera --------------------------------------------------------------------------------------------------------------------------
export class Camera {
  constructor(w = 960, h = 540) { this.vw = w; this.vh = h; this.zoom = 1; this.x = 0; this.y = 0; this.bounds = null; this.sh = 0; this.shT = 0; this.ox = 0; this.oy = 0; this.t = 0; this.kick = { x: 0, y: 0 }; }
  get w() { return this.vw / this.zoom; }
  get h() { return this.vh / this.zoom; }
  setBounds(x0, y0, x1, y1) { this.bounds = { x0, y0, x1, y1 }; }
  clamp() { const b = this.bounds; if (!b) return; const w = this.w, h = this.h; this.x = b.x1 - b.x0 <= w ? b.x0 - (w - (b.x1 - b.x0)) / 2 : clamp(this.x, b.x0, b.x1 - w); this.y = b.y1 - b.y0 <= h ? b.y0 - (h - (b.y1 - b.y0)) / 2 : clamp(this.y, b.y0, b.y1 - h); }
  snap(tx, ty) { this.x = tx - this.w / 2; this.y = ty - this.h / 2; this.clamp(); }
  follow(tx, ty, dt, rate = 7) { this.x = damp(this.x, tx - this.w / 2, rate, dt); this.y = damp(this.y, ty - this.h / 2, rate * 0.8, dt); this.clamp(); }
  shake(mag = 6, dur = 0.25) { if (mag >= this.sh) { this.sh = mag; this.shT = dur; this.shTot = dur; } }
  nudge(x, y) { this.kick.x += x; this.kick.y += y; }
  update(dt) {
    this.t += dt;
    if (this.shT > 0) { this.shT -= dt; const k = Math.max(0, this.shT / (this.shTot || 0.25)); this.ox = (Math.random() * 2 - 1) * this.sh * k; this.oy = (Math.random() * 2 - 1) * this.sh * k; if (this.shT <= 0) { this.sh = 0; this.ox = this.oy = 0; } }
    this.kick.x *= Math.max(0, 1 - 9 * dt); this.kick.y *= Math.max(0, 1 - 9 * dt);
  }
  begin(g) { g.save(); g.scale(this.zoom, this.zoom); g.translate(-Math.round((this.x + this.ox + this.kick.x) * 2) / 2, -Math.round((this.y + this.oy + this.kick.y) * 2) / 2); }
  end(g) { g.restore(); }
  toWorld(sx, sy) { return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y }; }
  toScreen(wx, wy) { return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom }; }
  visible(x, y, w, h, pad = 0) { return x + w > this.x - pad && x < this.x + this.w + pad && y + h > this.y - pad && y < this.y + this.h + pad; }
}

// short "hit stop" freeze + screen flash timers games can use
export class Juice {
  constructor() { this.freeze = 0; this.flash = 0; this.flashColor = "#fff"; this.slow = 0; this.slowScale = 1; }
  hitstop(t = 0.05) { this.freeze = Math.max(this.freeze, t); }
  doFlash(a = 0.5, color = "#fff") { this.flash = Math.max(this.flash, a); this.flashColor = color; }
  slowmo(t = 0.4, scale = 0.35) { this.slow = Math.max(this.slow, t); this.slowScale = scale; }
  update(dt) { this.flash = Math.max(0, this.flash - dt * 2.6); this.slow = Math.max(0, this.slow - dt); }
  // returns the time step games should use after freezes and slow motion
  step(dt) { if (this.freeze > 0) { this.freeze -= dt; return 0; } return this.slow > 0 ? dt * this.slowScale : dt; }
  draw(g, w, h) { if (this.flash > 0.01) { g.save(); g.globalAlpha = Math.min(0.85, this.flash); g.fillStyle = this.flashColor; g.fillRect(0, 0, w, h); g.restore(); } }
}
