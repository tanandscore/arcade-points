// Lumen Trail — procedural pixel sprites, parallax scenes and the "HD-2D" finish (chunky pixels, then soft glow, depth blur and vignette).
import { makeCanvas } from "../../core/draw";
import { shade, mix, rgba, TAU, hash2, clamp } from "../../core/util";

export const LW = 480, LH = 270; // the low-resolution canvas the world is drawn on (it is enlarged 2x with hard pixels)
const CACHE = new Map();
const cv = (key, w, h, fn) => { let c = CACHE.get(key); if (!c) { c = makeCanvas(w, h); const g = c.getContext("2d"); g.imageSmoothingEnabled = false; fn(g, w, h); CACHE.set(key, c); } return c; };
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const E = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
const OUTL = "#1b1226";

// ---- heroes (32 x 46) -----------------------------------------------------------------------------------------------------------------------
export function heroSprite(H, pose = "idle", f = 0) {
  return cv(`h|${H.id}|${pose}|${f}`, 40, 48, (g) => {
    const wk = pose === "walk" ? (f ? 2 : -2) : 0, bob = pose === "idle" ? f : 0, dead = pose === "ko";
    g.translate(4, 2);
    if (dead) { g.translate(0, 34); g.rotate(-Math.PI / 2 + 0.1); g.translate(-6, -2); }
    const body = H.color, dk = shade(body, -0.35), skin = H.skin, hair = H.hair;
    // legs
    R(g, 9, 34 + bob, 5, 11 - Math.max(0, -wk), shade(dk, -0.2)); R(g, 17, 34 + bob, 5, 11 - Math.max(0, wk), shade(dk, -0.2)); R(g, 8 + wk, 43, 7, 3, "#2a1d18"); R(g, 17 - wk, 43, 7, 3, "#2a1d18");
    // arms behind
    R(g, 5, 21 + bob, 5, 12, dk);
    // torso
    R(g, 8, 19 + bob, 16, 16, body); R(g, 8, 31 + bob, 16, 3, dk); R(g, 8, 19 + bob, 16, 2, shade(body, 0.25));
    if (H.id === "aldric") { R(g, 8, 19 + bob, 16, 4, "#b8bcc8"); R(g, 14, 19 + bob, 4, 14, "#8a8f9c"); R(g, 6, 19 + bob, 20, 3, "#d84a4a"); } // pauldrons + scarf
    if (H.id === "selene") { R(g, 7, 30 + bob, 18, 6, shade(body, -0.15)); R(g, 14, 22 + bob, 4, 9, "#ffd23a"); }
    if (H.id === "mirelle") { R(g, 6, 19 + bob, 20, 8, "#fff8e6"); R(g, 13, 22 + bob, 6, 9, "#ffd23a"); }
    if (H.id === "kestrel") { R(g, 8, 27 + bob, 16, 3, "#6b4a2a"); R(g, 12, 27 + bob, 3, 3, "#ffd23a"); }
    // head
    R(g, 10, 6 + bob, 13, 13, skin); R(g, 10, 6 + bob, 13, 13, skin);
    R(g, 12, 12 + bob, 2, 3, OUTL); R(g, 18, 12 + bob, 2, 3, OUTL); R(g, 14, 16 + bob, 4, 1, "#a05a4a");
    if (H.id === "aldric") { R(g, 9, 3 + bob, 15, 6, hair); R(g, 8, 5 + bob, 3, 8, hair); R(g, 22, 5 + bob, 2, 6, hair); }
    if (H.id === "selene") { R(g, 8, 4 + bob, 17, 7, hair); R(g, 7, 8 + bob, 4, 18, hair); R(g, 22, 8 + bob, 4, 18, hair); g.fillStyle = "#4a3ab0"; g.beginPath(); g.moveTo(5, 6 + bob); g.lineTo(27, 6 + bob); g.lineTo(17, -12 + bob); g.closePath(); g.fill(); R(g, 5, 5 + bob, 22, 3, "#3a2c90"); R(g, 15, 2 + bob, 3, 3, "#ffd23a"); }
    if (H.id === "mirelle") { R(g, 8, 3 + bob, 17, 8, "#fff8e6"); R(g, 7, 6 + bob, 4, 14, "#fff8e6"); R(g, 22, 6 + bob, 4, 14, "#fff8e6"); R(g, 10, 8 + bob, 3, 3, hair); R(g, 20, 8 + bob, 3, 3, hair); }
    if (H.id === "kestrel") { R(g, 8, 3 + bob, 17, 6, "#2f7a5a"); R(g, 8, 6 + bob, 4, 8, "#2f7a5a"); R(g, 14, 9 + bob, 6, 2, hair); R(g, 22, 8 + bob, 5, 4, "#2f7a5a"); }
    // front arm / weapon
    const w = pose === "atk" ? 1 : 0;
    R(g, 23, w ? 15 : 21 + bob, 5, w ? 8 : 12, skin);
    if (pose === "atk" || pose === "idle" || pose === "walk") weaponDraw(g, H, w, bob);
  });
}
function weaponDraw(g, H, atk, bob) {
  const x = 26, y = atk ? 11 : 27 + bob;
  if (H.id === "aldric") { R(g, x, y - 18, 3, 22, "#e4eaf4"); R(g, x - 3, y + 3, 9, 3, "#d4a83a"); R(g, x + 1, y - 18, 1, 22, "#ffffff"); }
  else if (H.id === "selene") { R(g, x + 1, y - 14, 3, 30, "#7a4a22"); E(g, x + 2, y - 16, 5, 5, "#ff77ff"); E(g, x + 2, y - 16, 2.5, 2.5, "#fff"); }
  else if (H.id === "mirelle") { R(g, x + 1, y - 10, 3, 24, "#c9a56a"); R(g, x - 3, y - 14, 11, 8, "#fff3b0"); R(g, x - 1, y - 12, 7, 5, "#ffd23a"); }
  else { R(g, x, y - 8, 3, 14, "#d8d0ff"); R(g, x - 1, y + 4, 5, 2, "#6b4a2a"); }
}

// ---- enemies ----------------------------------------------------------------------------------------------------------------------------------------
export function enemySprite(id, def) {
  const big = !!def.big, W = big ? 120 : 56, H = big ? 110 : 52;
  return cv(`e|${id}`, W, H, (g) => {
    const fx = SPR[def.spr || id] || SPR.slime; g.translate(W / 2, H - 2); fx(g);
  });
}
const SPR = {
  slime(g) { E(g, 0, -12, 20, 13, "#4ad0c8"); R(g, -20, -12, 40, 11, "#4ad0c8"); E(g, 0, -12, 20, 13, "#4ad0c8"); R(g, -14, -20, 10, 5, "#a8fff4"); E(g, -7, -12, 3, 4, OUTL); E(g, 7, -12, 3, 4, OUTL); R(g, -4, -5, 8, 2, OUTL); },
  bat(g) { g.fillStyle = "#5a3a7a"; g.beginPath(); g.moveTo(-4, -22); g.lineTo(-24, -34); g.lineTo(-20, -16); g.lineTo(-10, -20); g.lineTo(-6, -10); g.closePath(); g.fill(); g.beginPath(); g.moveTo(4, -22); g.lineTo(24, -34); g.lineTo(20, -16); g.lineTo(10, -20); g.lineTo(6, -10); g.closePath(); g.fill(); E(g, 0, -20, 8, 9, "#3a2650"); R(g, -6, -30, 3, 6, "#3a2650"); R(g, 3, -30, 3, 6, "#3a2650"); R(g, -4, -22, 2, 2, "#ff5a5a"); R(g, 2, -22, 2, 2, "#ff5a5a"); },
  wolf(g) { E(g, 0, -18, 20, 10, "#7a808c"); R(g, -18, -10, 4, 10, "#5e636e"); R(g, -8, -10, 4, 10, "#5e636e"); R(g, 6, -10, 4, 10, "#5e636e"); R(g, 14, -10, 4, 10, "#5e636e"); E(g, 20, -26, 9, 8, "#8a909c"); g.fillStyle = "#8a909c"; g.beginPath(); g.moveTo(16, -32); g.lineTo(18, -42); g.lineTo(22, -33); g.fill(); R(g, 25, -26, 6, 3, "#6a707c"); R(g, 22, -29, 2, 2, "#ffd23a"); g.fillStyle = "#7a808c"; g.beginPath(); g.moveTo(-20, -20); g.lineTo(-34, -30); g.lineTo(-18, -14); g.fill(); },
  sprout(g) { R(g, -10, -16, 20, 16, "#6aa84a"); E(g, 0, -22, 14, 12, "#78c056"); R(g, -8, -26, 5, 5, "#fff"); R(g, 3, -26, 5, 5, "#fff"); R(g, -6, -25, 2, 3, OUTL); R(g, 5, -25, 2, 3, OUTL); g.fillStyle = "#4a8a3a"; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 9 - 3, -32); g.lineTo(i * 12, -48); g.lineTo(i * 9 + 3, -32); g.fill(); } R(g, -4, -14, 8, 3, "#8a2a3a"); },
  skeleton(g) { R(g, -9, -14, 6, 14, "#e8e2cc"); R(g, 3, -14, 6, 14, "#e8e2cc"); R(g, -11, -34, 22, 20, "#e8e2cc"); for (let i = 0; i < 3; i++) R(g, -9, -32 + i * 6, 18, 2, "#6a6458"); E(g, 0, -42, 9, 9, "#f0ead2"); R(g, -5, -44, 3, 4, OUTL); R(g, 2, -44, 3, 4, OUTL); R(g, 11, -34, 4, 22, "#a8aebb"); R(g, 12, -40, 2, 8, "#d8dce8"); },
  goblin(g) { R(g, -7, -12, 5, 12, "#4a6a2a"); R(g, 2, -12, 5, 12, "#4a6a2a"); R(g, -9, -28, 18, 17, "#7a5a3a"); E(g, 0, -34, 10, 9, "#6aa04a"); g.fillStyle = "#6aa04a"; g.beginPath(); g.moveTo(-9, -36); g.lineTo(-20, -40); g.lineTo(-8, -30); g.fill(); g.beginPath(); g.moveTo(9, -36); g.lineTo(20, -40); g.lineTo(8, -30); g.fill(); R(g, -5, -36, 3, 3, "#ffd23a"); R(g, 2, -36, 3, 3, "#ffd23a"); R(g, 10, -26, 3, 14, "#b0b6c4"); },
  mushroom(g) { R(g, -7, -16, 14, 16, "#f0e2c4"); E(g, 0, -22, 21, 14, "#c0425a"); R(g, -21, -22, 42, 3, "#c0425a"); for (const [x, y] of [[-10, -28], [4, -32], [12, -24], [-4, -22]]) E(g, x, y, 3.5, 3.5, "#fff0f0"); R(g, -4, -12, 2, 4, OUTL); R(g, 3, -12, 2, 4, OUTL); },
  wisp(g) { E(g, 0, -26, 13, 15, "#8be0ff"); E(g, 0, -26, 8, 10, "#e8faff"); g.fillStyle = "#8be0ff"; g.beginPath(); g.moveTo(-10, -18); g.lineTo(0, 0); g.lineTo(10, -18); g.fill(); R(g, -5, -28, 3, 5, OUTL); R(g, 3, -28, 3, 5, OUTL); },
  iceknight(g) { R(g, -10, -14, 8, 14, "#9ab8d4"); R(g, 2, -14, 8, 14, "#9ab8d4"); R(g, -13, -38, 26, 26, "#b4d2ee"); R(g, -13, -38, 26, 5, "#e6f4ff"); E(g, 0, -46, 10, 10, "#c8e2f6"); R(g, -7, -47, 14, 4, OUTL); R(g, -2, -56, 4, 6, "#7fd6ff"); R(g, 13, -42, 4, 30, "#e0f2ff"); g.fillStyle = "#7fd6ff"; g.beginPath(); g.moveTo(-20, -30); g.lineTo(-13, -38); g.lineTo(-13, -14); g.lineTo(-22, -12); g.fill(); },
  crab(g) { E(g, 0, -14, 22, 12, "#d8573a"); R(g, -26, -22, 10, 10, "#e8704a"); R(g, 16, -22, 10, 10, "#e8704a"); R(g, -30, -30, 8, 8, "#e8704a"); R(g, 22, -30, 8, 8, "#e8704a"); for (let i = 0; i < 3; i++) { R(g, -20 + i * 5, -4, 2, 6, "#a8381f"); R(g, 10 + i * 5, -4, 2, 6, "#a8381f"); } R(g, -7, -28, 3, 6, "#fff"); R(g, 5, -28, 3, 6, "#fff"); R(g, -6, -26, 2, 3, OUTL); R(g, 6, -26, 2, 3, OUTL); },
  ghoul(g) { R(g, -10, -14, 7, 14, "#5a7a7a"); R(g, 3, -14, 7, 14, "#5a7a7a"); R(g, -12, -34, 24, 22, "#6a8f8f"); E(g, 0, -42, 10, 10, "#8ab0a8"); R(g, -6, -44, 4, 4, "#d8ff5a"); R(g, 3, -44, 4, 4, "#d8ff5a"); R(g, -16, -32, 5, 20, "#6a8f8f"); R(g, 11, -32, 5, 20, "#6a8f8f"); R(g, -4, -38, 8, 2, OUTL); },
  spider(g) { E(g, 0, -16, 14, 11, "#4a2a5a"); E(g, 12, -18, 8, 8, "#5a3a6a"); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { g.strokeStyle = "#3a1f4a"; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 6, -16); g.lineTo(s * (16 + i * 4), -26 + i * 5); g.lineTo(s * (22 + i * 5), 0); g.stroke(); } R(g, 14, -22, 3, 3, "#ff5a5a"); R(g, 10, -22, 3, 3, "#ff5a5a"); R(g, -4, -22, 5, 4, "#ff77aa"); },
  imp(g) { R(g, -7, -12, 5, 12, "#a83a2a"); R(g, 2, -12, 5, 12, "#a83a2a"); E(g, 0, -24, 11, 13, "#d8503a"); E(g, 0, -40, 9, 9, "#e8603f"); g.fillStyle = "#ffd23a"; g.beginPath(); g.moveTo(-7, -46); g.lineTo(-11, -56); g.lineTo(-2, -48); g.fill(); g.beginPath(); g.moveTo(7, -46); g.lineTo(11, -56); g.lineTo(2, -48); g.fill(); R(g, -5, -42, 3, 3, "#ffd23a"); R(g, 2, -42, 3, 3, "#ffd23a"); E(g, 14, -28, 5, 5, "#ff9a3c"); g.fillStyle = "#a83a2a"; g.beginPath(); g.moveTo(-10, -30); g.lineTo(-24, -42); g.lineTo(-8, -20); g.fill(); },
  golemlet(g) { R(g, -16, -16, 12, 16, "#5a4a44"); R(g, 4, -16, 12, 16, "#5a4a44"); R(g, -20, -48, 40, 34, "#7a6258"); E(g, 0, -56, 12, 10, "#8a7066"); for (const [x, y] of [[-12, -40], [8, -34], [-2, -24]]) R(g, x, y, 6, 3, "#ff7a3c"); R(g, -6, -58, 4, 3, "#ffb04a"); R(g, 3, -58, 4, 3, "#ffb04a"); R(g, -30, -44, 10, 28, "#6a554c"); R(g, 20, -44, 10, 28, "#6a554c"); },
  blackknight(g) { R(g, -10, -14, 8, 14, "#2a2a38"); R(g, 2, -14, 8, 14, "#2a2a38"); R(g, -14, -40, 28, 28, "#3a3a4c"); R(g, -14, -40, 28, 5, "#5a5a70"); E(g, 0, -48, 10, 10, "#4a4a5e"); R(g, -7, -49, 14, 4, "#ff3a4a"); R(g, -2, -62, 4, 12, "#a02a3a"); R(g, 14, -48, 5, 36, "#b8bccc"); R(g, 12, -16, 9, 4, "#d4a83a"); },
  // ---- bosses (about 100 px) ----
  mossmaw(g) { E(g, 0, -34, 44, 32, "#4a8a3a"); E(g, 0, -42, 38, 28, "#5ca046"); R(g, -44, -34, 88, 30, "#4a8a3a"); for (let i = -2; i <= 2; i++) { g.fillStyle = "#3a6a2a"; g.beginPath(); g.moveTo(i * 17 - 7, -60); g.lineTo(i * 20, -92); g.lineTo(i * 17 + 7, -60); g.fill(); } R(g, -26, -58, 12, 12, "#fff"); R(g, 14, -58, 12, 12, "#fff"); R(g, -22, -54, 6, 8, OUTL); R(g, 18, -54, 6, 8, OUTL); R(g, -22, -34, 44, 14, "#8a2a3a"); for (let i = 0; i < 6; i++) { R(g, -20 + i * 7, -34, 4, 6, "#f4ecd8"); } g.fillStyle = "#3a6a2a"; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 40, -10); g.quadraticCurveTo(s * 70, -20, s * 56, -60); g.lineTo(s * 48, -58); g.quadraticCurveTo(s * 56, -26, s * 38, -2); g.fill(); } },
  warden(g) { R(g, -28, -30, 20, 30, "#5a5058"); R(g, 8, -30, 20, 30, "#5a5058"); R(g, -38, -86, 76, 62, "#7a6e76"); R(g, -38, -86, 76, 8, "#968a92"); E(g, 0, -98, 22, 18, "#8a7e86"); R(g, -12, -102, 8, 6, "#ffb04a"); R(g, 5, -102, 8, 6, "#ffb04a"); R(g, -8, -90, 16, 4, OUTL); R(g, -56, -80, 20, 56, "#68606a"); R(g, 36, -80, 20, 56, "#68606a"); R(g, -60, -30, 28, 16, "#8a7e86"); R(g, 32, -30, 28, 16, "#8a7e86"); for (let i = 0; i < 4; i++) R(g, -26 + i * 16, -70 + (i % 2) * 14, 8, 3, "#ff7a3c"); },
  drake(g) { g.fillStyle = "#6aa8d8"; g.beginPath(); g.moveTo(-10, -50); g.lineTo(-56, -96); g.lineTo(-44, -50); g.lineTo(-30, -66); g.lineTo(-18, -34); g.fill(); g.beginPath(); g.moveTo(10, -50); g.lineTo(56, -96); g.lineTo(44, -50); g.lineTo(30, -66); g.lineTo(18, -34); g.fill(); E(g, 0, -34, 26, 28, "#8cc4ee"); E(g, 0, -28, 15, 20, "#d8eeff"); E(g, 18, -64, 14, 12, "#9acdf2"); R(g, 24, -66, 14, 6, "#8cc4ee"); R(g, 24, -66, 4, 3, "#ff5a5a"); g.fillStyle = "#e8f6ff"; g.beginPath(); g.moveTo(10, -72); g.lineTo(8, -88); g.lineTo(16, -74); g.fill(); R(g, -16, -8, 8, 10, "#6aa8d8"); R(g, 8, -8, 8, 10, "#6aa8d8"); g.fillStyle = "#6aa8d8"; g.beginPath(); g.moveTo(-24, -20); g.lineTo(-50, -4); g.lineTo(-24, -10); g.fill(); },
  hydra(g) { E(g, 0, -20, 40, 20, "#2a7a8a"); for (let i = -3; i <= 3; i++) { const x = i * 13, h = 50 + (3 - Math.abs(i)) * 12; g.strokeStyle = "#35949f"; g.lineWidth = 9; g.beginPath(); g.moveTo(x * 0.6, -26); g.quadraticCurveTo(x * 1.4, -h * 0.6, x * 1.2, -h); g.stroke(); E(g, x * 1.2, -h - 4, 9, 7, "#46aab4"); R(g, x * 1.2 + 2, -h - 7, 3, 3, "#ffd23a"); } R(g, -40, -6, 80, 8, "#1f5f6b"); },
  ashen(g) { R(g, -16, -22, 12, 22, "#2a2022"); R(g, 4, -22, 12, 22, "#2a2022"); R(g, -26, -70, 52, 52, "#3a2e30"); R(g, -26, -70, 52, 8, "#5a4a4c"); R(g, -36, -66, 14, 14, "#6a5658"); R(g, 22, -66, 14, 14, "#6a5658"); E(g, 0, -82, 16, 16, "#4a3a3c"); R(g, -10, -84, 20, 5, "#ff6a2a"); R(g, -3, -108, 6, 24, "#ff4a1a"); g.fillStyle = "#ff7a3c"; g.beginPath(); g.moveTo(-6, -110); g.lineTo(0, -126); g.lineTo(6, -110); g.fill(); R(g, 26, -88, 6, 76, "#c8c0b8"); R(g, 22, -26, 14, 5, "#ff9a3c"); E(g, 0, -40, 8, 8, "#ff7a3c"); },
  king(g) { g.fillStyle = "#1c1424"; g.beginPath(); g.moveTo(-34, 0); g.lineTo(-24, -80); g.lineTo(24, -80); g.lineTo(34, 0); g.fill(); R(g, -22, -92, 44, 26, "#2c2236"); E(g, 0, -98, 16, 16, "#3a2e46"); R(g, -8, -100, 5, 6, "#ffd23a"); R(g, 4, -100, 5, 6, "#ffd23a"); for (let i = -2; i <= 2; i++) { g.fillStyle = "#4a3a5a"; g.beginPath(); g.moveTo(i * 8 - 4, -110); g.lineTo(i * 8, -124 + Math.abs(i) * 4); g.lineTo(i * 8 + 4, -110); g.fill(); } E(g, 0, -50, 12, 12, "#ffe27a"); E(g, 0, -50, 6, 6, "#fff"); g.fillStyle = "#2c2236"; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, -76); g.lineTo(s * 56, -60); g.lineTo(s * 50, -30); g.lineTo(s * 24, -50); g.fill(); } for (const s of [-1, 1]) for (let i = 0; i < 3; i++) R(g, s * (32 + i * 8) - 3, -52 - i * 6, 6, 18, "#a46bff"); },
};
export const spriteH = (id, def) => (def.big ? 110 : 52);

// ---- scenes ------------------------------------------------------------------------------------------------------------------------------------------------
const TH = {
  forest: { sky: ["#6fb7a0", "#cfe8b0"], far: "#4a8f78", mid: "#2f6a4a", near: "#244f38", ground: "#3a5a2c", top: "#5da040", kind: "trees", fx: "fireflies", tone: "#fff3b0" },
  cave: { sky: ["#1a1228", "#3a2840"], far: "#2a1f3a", mid: "#3d2c4a", near: "#2a1d35", ground: "#4a3a52", top: "#6a5470", kind: "stalag", fx: "embers", tone: "#ff9a5a" },
  snow: { sky: ["#8fb0d8", "#e8f0fa"], far: "#b4c8e0", mid: "#8fa8c8", near: "#6a86a8", ground: "#e8f0fa", top: "#ffffff", kind: "peaks", fx: "snow", tone: "#cfe8ff" },
  ruins: { sky: ["#2a5f7a", "#8fd0d8"], far: "#2f6f80", mid: "#3d8a94", near: "#25606c", ground: "#5a8a86", top: "#8fc4bc", kind: "pillars", fx: "bubbles", tone: "#bff4ff" },
  volcano: { sky: ["#3a1018", "#d8602a"], far: "#4a1a1a", mid: "#6a2a20", near: "#3a1614", ground: "#4a2420", top: "#8a3a2a", kind: "peaks", fx: "embers", tone: "#ff9a3c" },
  dungeon: { sky: ["#120a1c", "#2a1a3a"], far: "#1c1228", mid: "#2c1c3c", near: "#1a1026", ground: "#3a2a4a", top: "#5a4470", kind: "pillars", fx: "embers", tone: "#d89aff" },
};
const hz = (i, s = 0) => hash2(i, s, 7);
export function drawScene(g, theme, scroll, t, opts = {}) {
  const T = TH[theme] || TH.forest, GY = opts.groundY ?? 200;
  const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, LW, LH);
  // sun / moon
  if (theme === "forest" || theme === "snow" || theme === "ruins") { g.fillStyle = rgba("#fff8d0", 0.9); g.beginPath(); g.arc(360, 50, 18, 0, TAU); g.fill(); }
  if (theme === "volcano") { g.fillStyle = rgba("#ffd870", 0.9); g.beginPath(); g.arc(120, 70, 24, 0, TAU); g.fill(); }
  const layer = (par, base, col, h, kind, seed, density) => {
    g.fillStyle = col; const o = -((scroll * par) % 160 + 160) % 160;
    for (let x = o - 160; x < LW + 160; x += 20) {
      const i = Math.floor((x + scroll * par) / 20), k = hz(i, seed), hh = h * (0.55 + k * 0.8);
      if (kind === "trees") { g.beginPath(); g.moveTo(x - 14, base); g.lineTo(x, base - hh); g.lineTo(x + 14, base); g.fill(); if (k > 0.4) { g.beginPath(); g.moveTo(x - 11, base - hh * 0.4); g.lineTo(x, base - hh * 1.2); g.lineTo(x + 11, base - hh * 0.4); g.fill(); } }
      else if (kind === "stalag") { g.beginPath(); g.moveTo(x - 9, 0); g.lineTo(x, hh * 0.9); g.lineTo(x + 9, 0); g.fill(); g.beginPath(); g.moveTo(x - 10, base); g.lineTo(x + 2, base - hh * 0.7); g.lineTo(x + 12, base); g.fill(); }
      else if (kind === "peaks") { g.beginPath(); g.moveTo(x - 36, base); g.lineTo(x, base - hh * 1.4); g.lineTo(x + 36, base); g.fill(); }
      else { g.fillRect(x - 6, base - hh * 1.2, 12, hh * 1.2); if (k > 0.5) { g.fillRect(x - 9, base - hh * 1.2, 18, 5); } }
    }
  };
  layer(0.15, GY - 40, T.far, 70, T.kind === "stalag" ? "stalag" : T.kind === "pillars" ? "pillars" : "peaks", 1);
  layer(0.4, GY - 10, T.mid, 60, T.kind, 2);
  // glow behind mid layer
  const gl = g.createLinearGradient(0, GY - 60, 0, GY); gl.addColorStop(0, rgba(T.tone, 0)); gl.addColorStop(1, rgba(T.tone, 0.22)); g.fillStyle = gl; g.fillRect(0, GY - 60, LW, 60);
  // ground
  g.fillStyle = T.ground; g.fillRect(0, GY, LW, LH - GY); g.fillStyle = shade(T.top, -0.25); g.fillRect(0, GY, LW, 3);
  const o2 = -((scroll) % 32 + 32) % 32; g.fillStyle = shade(T.ground, -0.15); for (let x = o2 - 32; x < LW + 32; x += 32) { g.fillRect(x, GY + 14 + ((x / 32) & 1) * 6, 20, 3); g.fillRect(x + 12, GY + 36, 14, 2); }
  g.fillStyle = shade(T.ground, -0.3); g.fillRect(0, GY + 60, LW, LH);
  // foreground silhouettes (these get blurred by the HD finish)
  if (!opts.noFore) { const o3 = -((scroll * 1.5) % 300 + 300) % 300; g.fillStyle = shade(T.near, -0.3); for (let x = o3 - 300; x < LW + 300; x += 150) { const k = hz(Math.floor((x + scroll * 1.5) / 150), 9); if (T.kind === "trees" || T.kind === "peaks") { g.beginPath(); g.moveTo(x - 18, LH); g.lineTo(x, LH - 70 - k * 40); g.lineTo(x + 18, LH); g.fill(); } else g.fillRect(x - 8, LH - 60 - k * 40, 16, 120); } }
  // drifting particles
  const n = 34; for (let i = 0; i < n; i++) {
    const k = hz(i, 3), k2 = hz(i, 4); let x = ((k * 600 - t * (T.fx === "snow" ? 18 : 6) - scroll * 0.9) % 520 + 520) % 520 - 20, y;
    if (T.fx === "snow") { y = ((k2 * 300 + t * 30) % 280); g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(x, y, 2, 2); }
    else if (T.fx === "embers") { y = 260 - ((k2 * 260 + t * 22) % 260); g.fillStyle = rgba(T.tone, 0.8); g.fillRect(x, y, 2, 2); }
    else if (T.fx === "bubbles") { y = 270 - ((k2 * 270 + t * 14) % 270); g.fillStyle = "rgba(220,255,255,.5)"; g.fillRect(x, y, 3, 3); }
    else { y = 120 + k2 * 80 + Math.sin(t * 1.5 + i) * 8; g.fillStyle = rgba(T.tone, 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + i))); g.fillRect(x, y, 2, 2); }
  }
  return T;
}

// ---- the HD finish: bloom + depth blur + vignette, drawn on the full-size canvas ---------------------------------------------------------------
const MID = { c: null }, BLOOM = { c: null };
export function hd2d(g, lo, t, o = {}) {
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(lo, 0, 0, 960, 540);
  // soft copies (small canvases scale up smoothly, which is a free blur)
  const mid = MID.c || (MID.c = makeCanvas(160, 90)), mg = mid.getContext("2d"); mg.imageSmoothingEnabled = true; mg.drawImage(lo, 0, 0, 160, 90);
  g.imageSmoothingEnabled = true;
  // depth-of-field: blur the top and the bottom bands, fading into the sharp middle
  const bands = [[0, 0.12, 0.95], [0.12, 0.2, 0.6], [0.2, 0.28, 0.25], [0.74, 0.8, 0.25], [0.8, 0.88, 0.6], [0.88, 1, 0.95]];
  for (const [a, b, al] of bands) { g.save(); g.beginPath(); g.rect(0, a * 540, 960, (b - a) * 540 + 1); g.clip(); g.globalAlpha = al * (o.dof ?? 1); g.drawImage(mid, 0, 0, 960, 540); g.restore(); }
  // bloom
  const bl = BLOOM.c || (BLOOM.c = makeCanvas(96, 54)), bg = bl.getContext("2d"); bg.imageSmoothingEnabled = true; bg.globalCompositeOperation = "source-over"; bg.drawImage(lo, 0, 0, 96, 54);
  g.globalCompositeOperation = "lighter"; g.globalAlpha = o.bloom ?? 0.38; g.drawImage(bl, 0, 0, 960, 540); g.globalAlpha = (o.bloom ?? 0.38) * 0.6; g.drawImage(mid, 0, 0, 960, 540);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  // vignette + light shafts
  const v = g.createRadialGradient(480, 270, 220, 480, 270, 620); v.addColorStop(0, "rgba(10,5,25,0)"); v.addColorStop(1, `rgba(10,5,25,${o.vig ?? 0.55})`); g.fillStyle = v; g.fillRect(0, 0, 960, 540);
  g.globalCompositeOperation = "lighter"; for (let i = 0; i < 3; i++) { const x = 200 + i * 260 + Math.sin(t * 0.3 + i) * 30; const sg = g.createLinearGradient(x, 0, x + 120, 540); sg.addColorStop(0, "rgba(255,240,200,.07)"); sg.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = sg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x + 230, 540); g.lineTo(x + 40, 540); g.fill(); }
  g.restore();
}
