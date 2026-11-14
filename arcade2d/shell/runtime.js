// The engine room of every 2D game: canvas sizing, a fixed 60 Hz update loop, pause, and handing the right things to the
// level "session". It knows nothing about React; the shell (Kit.js) just starts and stops it.
import { Input } from "../core/input";
import { sfx, music, unlock, applyMute } from "../core/audio";
import { isMuted } from "@/lib/sound";

export const VIEW = { w: 960, h: 540 };
const STEP = 1 / 60;

export class Runtime {
  constructor(canvas, root, def, hooks = {}) {
    this.canvas = canvas; this.root = root; this.def = def; this.g = canvas.getContext("2d"); this.hooks = hooks;
    this.input = new Input(); this.t = 0; this.acc = 0; this.last = 0; this.raf = 0; this.running = false; this.paused = false;
    this.session = null; this.idle = null; this.layout = { s: 1, ox: 0, oy: 0, cssW: 960, cssH: 540, dpr: 1 }; this.reported = false; this.doneT = 0; this.muteCheck = 0;
    this.env = { t: 0, w: VIEW.w, h: VIEW.h, sfx, music, input: this.input, def, save: null, rt: this };
    canvas.__rt = this;
  }
  attach() {
    this.input.attach(this.canvas, VIEW);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.root); this.resize();
    this._vis = () => { if (document.hidden) this.setPaused(true, true); }; document.addEventListener("visibilitychange", this._vis);
    this._win = () => this.resize(); window.addEventListener("resize", this._win);
  }
  detach() { this.stop(); this.input.detach(); this.ro && this.ro.disconnect(); document.removeEventListener("visibilitychange", this._vis); window.removeEventListener("resize", this._win); }
  resize() {
    const r = this.root.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), cssW = Math.max(2, r.width), cssH = Math.max(2, r.height);
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const s = Math.min(cssW / VIEW.w, cssH / VIEW.h), ox = (cssW - VIEW.w * s) / 2, oy = (cssH - VIEW.h * s) / 2;
    this.layout = { s, ox, oy, cssW, cssH, dpr }; this.input.map = { ox, oy, s }; this.input.rect = null;
    this.hooks.onLayout && this.hooks.onLayout(this.layout);
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (now) => { if (!this.running) return; this.frame(now); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  setPaused(p, auto = false) { if (this.paused === p) return; this.paused = p; if (!p) { this.input.flush(); this.acc = 0; this.last = performance.now(); } this.hooks.onPause && this.hooks.onPause(p, auto); }
  begin(session) { this.session = session; this.reported = false; this.doneT = 0; this.paused = false; this.acc = 0; }
  end() { this.session = null; this.reported = false; }
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.acc += dt;
    let n = 0; while (this.acc >= STEP && n < 5) { this.step(STEP); this.acc -= STEP; n++; } if (n === 5) this.acc = 0;
    this.render();
  }
  step(dt) {
    this.input.beginStep(); this.t += dt; this.env.t = this.t;
    if ((this.muteCheck -= dt) <= 0) { this.muteCheck = 0.5; applyMute(); }
    const s = this.session;
    if (!s) { this.idle && this.idle.update && this.idle.update(dt, this.env); return; }
    if (this.paused) return;
    if (this.input.pressed("pause") && !s.done) { this.setPaused(true); return; }
    s.update(dt, this.input, this.env);
    if (s.done && !this.reported) { this.doneT += dt; if (this.doneT >= (s.done.delay ?? 1.1)) { this.reported = true; this.hooks.onEnd && this.hooks.onEnd(s); } }
  }
  render() {
    const { g } = this, L = this.layout;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0a0520"; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(L.s * L.dpr, 0, 0, L.s * L.dpr, L.ox * L.dpr, L.oy * L.dpr);
    g.save(); g.beginPath(); g.rect(0, 0, VIEW.w, VIEW.h); g.clip();
    try {
      if (this.session) this.session.draw(g, this.env); else if (this.idle && this.idle.draw) this.idle.draw(g, this.env);
    } catch (e) { if (!this._err) { this._err = true; console.error("[kit] draw error", e); } }
    g.restore();
  }
  unlockAudio() { unlock(); applyMute(); }
}
export const muted = () => isMuted();
