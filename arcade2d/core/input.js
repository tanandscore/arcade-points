// Keyboard, touch buttons, gamepad and pointer in one place.
// Games ask for ACTIONS ("left", "jump", "fire") instead of key names, so the same game works with
// the keyboard, the on-screen touch buttons and a gamepad without any extra code.

const BINDINGS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: ["Space", "KeyZ", "KeyK"],
  fire: ["KeyX", "KeyJ", "KeyF"],
  alt: ["KeyC", "KeyL", "ShiftLeft", "ShiftRight"],
  swap: ["KeyQ", "KeyE", "Tab"],
  pause: ["KeyP", "Escape"],
  confirm: ["Enter", "Space"],
  restart: ["KeyR"],
};
const PREVENT = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "KeyZ", "KeyX", "KeyC"]);
const CODE_TO_ACTIONS = {};
for (const [a, codes] of Object.entries(BINDINGS)) for (const c of codes) (CODE_TO_ACTIONS[c] ||= []).push(a);

export class Input {
  constructor() {
    this.keys = new Set();          // raw key codes currently down
    this.virt = {};                 // action -> count of touch buttons holding it
    this.pad = {};                  // action -> bool from the gamepad
    this.enabled = true;
    this._pressBuf = new Set(); this._relBuf = new Set(); this._keyPressBuf = new Set();
    this._pressNow = new Set(); this._relNow = new Set(); this._keyPressNow = new Set();
    this._held = {}; this._prevHeld = {};
    this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false, inside: false, dx: 0, dy: 0, id: -1, type: "mouse" };
    this._pPressBuf = false; this._pRelBuf = false;
    this.wheel = 0;
    this.view = { w: 960, h: 540 };
    this.map = null; // { ox, oy, s } = where the 960x540 play area sits inside the canvas (set by the runtime)
    this.rect = null;
    this._bound = false;
    this.lastDevice = "keyboard";
  }

  attach(canvas, view) {
    if (this._bound) this.detach();
    this.canvas = canvas; if (view) this.view = view;
    this._kd = (e) => this._keyDown(e); this._ku = (e) => this._keyUp(e); this._blur = () => this.releaseAll();
    window.addEventListener("keydown", this._kd); window.addEventListener("keyup", this._ku); window.addEventListener("blur", this._blur);
    this._pd = (e) => this._ptrDown(e); this._pm = (e) => this._ptrMove(e); this._pu = (e) => this._ptrUp(e);
    canvas.addEventListener("pointerdown", this._pd); window.addEventListener("pointermove", this._pm); window.addEventListener("pointerup", this._pu); window.addEventListener("pointercancel", this._pu);
    this._wh = (e) => { this.wheel += Math.sign(e.deltaY); };
    canvas.addEventListener("wheel", this._wh, { passive: true });
    this._ctx = (e) => e.preventDefault(); canvas.addEventListener("contextmenu", this._ctx);
    this._bound = true;
  }
  detach() {
    if (!this._bound) return;
    window.removeEventListener("keydown", this._kd); window.removeEventListener("keyup", this._ku); window.removeEventListener("blur", this._blur);
    this.canvas.removeEventListener("pointerdown", this._pd); window.removeEventListener("pointermove", this._pm); window.removeEventListener("pointerup", this._pu); window.removeEventListener("pointercancel", this._pu);
    this.canvas.removeEventListener("wheel", this._wh); this.canvas.removeEventListener("contextmenu", this._ctx);
    this._bound = false;
  }
  releaseAll() { this.keys.clear(); this.virt = {}; this.pointer.down = false; }
  // forget key presses that have not been used yet (after un-pausing, so the key that resumed does not pause again)
  flush() { this._pressBuf = new Set(); this._relBuf = new Set(); this._keyPressBuf = new Set(); this._pressNow = new Set(); this._relNow = new Set(); this._keyPressNow = new Set(); this._pPressBuf = false; this._pRelBuf = false; }

  _keyDown(e) {
    if (!this.enabled) return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.lastDevice = "keyboard";
    this.keys.add(e.code); this._keyPressBuf.add(e.code);
    const acts = CODE_TO_ACTIONS[e.code]; if (acts) for (const a of acts) this._pressBuf.add(a);
  }
  _keyUp(e) {
    this.keys.delete(e.code);
    const acts = CODE_TO_ACTIONS[e.code]; if (acts) for (const a of acts) if (!this.isHeld(a)) this._relBuf.add(a);
  }
  _setRect() { this.rect = this.canvas.getBoundingClientRect(); }
  _toLogical(e) {
    const r = this.rect || (this._setRect(), this.rect), m = this.map;
    if (m) { this.pointer.x = (e.clientX - r.left - m.ox) / m.s; this.pointer.y = (e.clientY - r.top - m.oy) / m.s; return; }
    this.pointer.x = ((e.clientX - r.left) / Math.max(1, r.width)) * this.view.w;
    this.pointer.y = ((e.clientY - r.top) / Math.max(1, r.height)) * this.view.h;
  }
  _ptrDown(e) {
    this._setRect(); this._toLogical(e);
    const p = this.pointer; p.down = true; p.id = e.pointerId; p.type = e.pointerType || "mouse"; p.inside = true; this._pPressBuf = true; p.dx = 0; p.dy = 0;
    this.lastDevice = p.type === "touch" ? "touch" : "mouse";
    try { this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType === "mouse" && e.button === 2) this._pressBuf.add("alt");
  }
  _ptrMove(e) {
    const p = this.pointer; if (p.down && p.id !== e.pointerId && p.id !== -1) return;
    const ox = p.x, oy = p.y; this.rect = this.canvas.getBoundingClientRect(); this._toLogical(e);
    p.dx += p.x - ox; p.dy += p.y - oy;
    const r = this.rect; p.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  _ptrUp(e) {
    const p = this.pointer; if (p.id !== -1 && e.pointerId !== p.id) return;
    if (p.down) this._pRelBuf = true; p.down = false; p.id = -1;
  }

  // touch buttons call this
  virtual(action, on) {
    const prev = (this.virt[action] || 0) > 0;
    this.virt[action] = Math.max(0, (this.virt[action] || 0) + (on ? 1 : -1));
    const now = this.virt[action] > 0;
    this.lastDevice = "touch";
    if (!prev && now) this._pressBuf.add(action);
    if (prev && !now) this._relBuf.add(action);
  }

  _pollPad() {
    let gp = null; try { gp = (navigator.getGamepads && navigator.getGamepads()) || []; } catch { gp = []; }
    let pad = null; for (const g of gp) if (g && g.connected) { pad = g; break; }
    const next = { left: false, right: false, up: false, down: false, jump: false, fire: false, alt: false, pause: false, confirm: false, swap: false };
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      next.left = ax < -0.45 || b(14); next.right = ax > 0.45 || b(15); next.up = ay < -0.5 || b(12); next.down = ay > 0.5 || b(13);
      next.jump = b(0); next.fire = b(2) || b(7); next.alt = b(1) || b(3) || b(6); next.pause = b(9); next.confirm = b(0); next.swap = b(4) || b(5);
      if (Object.values(next).some(Boolean)) this.lastDevice = "pad";
    }
    for (const a of Object.keys(next)) { if (next[a] && !this.pad[a]) this._pressBuf.add(a); if (!next[a] && this.pad[a]) this._relBuf.add(a); }
    this.pad = next;
  }

  isHeld(a) {
    if ((this.virt[a] || 0) > 0 || this.pad[a]) return true;
    const codes = BINDINGS[a]; if (!codes) return false;
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  // Called once at the start of every fixed update step.
  beginStep() {
    this._pollPad();
    this._pressNow = this._pressBuf; this._relNow = this._relBuf; this._keyPressNow = this._keyPressBuf;
    this._pressBuf = new Set(); this._relBuf = new Set(); this._keyPressBuf = new Set();
    const p = this.pointer; p.pressed = this._pPressBuf; p.released = this._pRelBuf; this._pPressBuf = false; this._pRelBuf = false;
    this._stepDx = p.dx; this._stepDy = p.dy; p.dx = 0; p.dy = 0;
    this.wheelNow = this.wheel; this.wheel = 0;
  }
  held(a) { return this.enabled && this.isHeld(a); }
  pressed(a) { return this.enabled && this._pressNow.has(a); }
  released(a) { return this._relNow.has(a); }
  keyHeld(code) { return this.keys.has(code); }
  keyPressed(code) { return this._keyPressNow.has(code); }
  axis(neg, pos) { return (this.held(pos) ? 1 : 0) - (this.held(neg) ? 1 : 0); }
  // for tests and bots: act as if the key went down/up
  press(code) { this._keyDown({ code, target: null, preventDefault() {}, repeat: false }); }
  release(code) { this._keyUp({ code }); }
}
