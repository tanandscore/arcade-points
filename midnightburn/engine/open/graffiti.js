// Midnight Burn — wall graffiti. One painted atlas (spray-paint pieces on a transparent background): street tags, throw-ups, stencils,
// and — much more rarely — "MIDNIGHT BURN MUMBAI" pieces by the game's own crew. chunks3d lays a few of them on quiet walls and
// bridge piers; the rest of the city stays clean.
import * as THREE from "three";
import { mulberry } from "./geo";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const AW = 2048, AH = 1280;
// regular pieces: 512 x 256 cells in rows 0..2; crew pieces: 1024 x 256 cells in rows 3..4
export const REG_N = 11, MB_N = 3;
const regRect = (i) => ({ x: (i % 4) * 512, y: Math.floor(i / 4) * 256, w: 512, h: 256 });
const mbRect = (j) => ({ x: (j % 2) * 1024, y: 768 + Math.floor(j / 2) * 256, w: 1024, h: 256 });
const uvOf = (r) => [r.x / AW, 1 - (r.y + r.h) / AH, (r.x + r.w) / AW, 1 - r.y / AH]; // u0, v bottom, u1, v top
export const pieceUV = (mb, i) => uvOf(mb ? mbRect(i) : regRect(i));
export const pieceAspect = (mb) => (mb ? 4 : 2);

const FONT = (px) => `${px}px Impact, "Arial Black", "Haettenschweiler", "Franklin Gothic Heavy", sans-serif`;

export function graffitiAtlas() {
  const c = cv(AW, AH), g = c.getContext("2d"), rnd = mulberry(1313); g.clearRect(0, 0, AW, AH);
  // a text piece: shadow, thick outline, gradient fill, highlight, drips and a mist of over-spray
  const piece = (r, text, o) => {
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.translate(r.x + r.w / 2 + (o.dx || 0), r.y + r.h * (o.cy ?? 0.5)); g.rotate(o.rot || 0);
    let px = o.px || r.h * 0.7; g.font = FONT(px); while (g.measureText(text).width > r.w * (o.fit || 0.88) && px > 20) { px -= 4; g.font = FONT(px); }
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.miterLimit = 2; const lw = o.lw ?? px * 0.13;
    if (o.skew) g.transform(1, 0, o.skew, 1, 0, 0);
    if (o.shadow) { g.fillStyle = o.shadow; g.strokeStyle = o.shadow; g.lineWidth = lw * 2; for (let k = 1; k <= (o.depth || 5); k++) { g.strokeText(text, k * 2.2, k * 2.2); } g.fillText(text, (o.depth || 5) * 2.2, (o.depth || 5) * 2.2); }
    g.strokeStyle = o.out; g.lineWidth = lw * 2; g.strokeText(text, 0, 0);
    const gr = g.createLinearGradient(0, -px * 0.5, 0, px * 0.5); const fc = o.fill; fc.forEach((cc, i) => gr.addColorStop(fc.length === 1 ? 0 : i / (fc.length - 1), cc)); g.fillStyle = gr; g.fillText(text, 0, 0);
    if (o.inner) { g.strokeStyle = o.inner; g.lineWidth = Math.max(2, lw * 0.35); g.strokeText(text, 0, 0); }
    g.globalAlpha = 0.55; g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(2, px * 0.03); g.save(); g.translate(-px * 0.02, -px * 0.03); g.beginPath(); g.strokeText(text, 0, 0); g.restore(); g.globalAlpha = 1;
    // drips: thin runs hanging from the underside of the letters
    const tw = g.measureText(text).width; const nd = o.drips ?? 7; for (let k = 0; k < nd; k++) { const x = -tw * 0.45 + rnd() * tw * 0.9, y0 = px * (0.28 + rnd() * 0.12), l = px * (0.15 + rnd() * 0.5), wd = Math.max(2, px * 0.03 + rnd() * 2); g.fillStyle = k % 2 ? o.out : fc[Math.min(fc.length - 1, 1)]; g.beginPath(); g.moveTo(x - wd / 2, y0); g.lineTo(x + wd / 2, y0); g.lineTo(x + wd / 2, y0 + l); g.arc(x, y0 + l, wd / 2, 0, Math.PI); g.lineTo(x - wd / 2, y0); g.fill(); }
    g.restore();
    // over-spray: specks in the colour of the fill drifting round the piece
    for (let i = 0; i < 160; i++) { const sx = r.x + r.w * (0.05 + rnd() * 0.9), sy = r.y + r.h * (0.12 + rnd() * 0.76); g.fillStyle = o.fill[0]; g.globalAlpha = 0.06 + rnd() * 0.18; g.beginPath(); g.arc(sx, sy, 0.6 + rnd() * 1.6, 0, 7); g.fill(); } g.globalAlpha = 1;
  };
  const circle = (x, y, rad, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.globalAlpha = 1; };
  // ---- regular street pieces ------------------------------------------------------------------------------------------------------------
  piece(regRect(0), "RAZE", { fill: ["#ffffff", "#c9a8ff"], out: "#3a1a78", shadow: "#16082e", rot: -0.05, drips: 8 });
  piece(regRect(1), "KAALI", { fill: ["#fff36a", "#ffb020"], out: "#1a1208", inner: "#a84a00", rot: 0.04, skew: -0.16, drips: 6 });
  { const r = regRect(2); g.save(); g.fillStyle = "#101014"; g.beginPath(); // stencil crown above the word
    const cx = r.x + 256, cy = r.y + 64; g.moveTo(cx - 70, cy + 40); g.lineTo(cx - 80, cy - 30); g.lineTo(cx - 40, cy); g.lineTo(cx, cy - 46); g.lineTo(cx + 40, cy); g.lineTo(cx + 80, cy - 30); g.lineTo(cx + 70, cy + 40); g.closePath(); g.fill(); g.fillStyle = "#e32b2b"; for (const dx of [-80, 0, 80]) { g.beginPath(); g.arc(cx + dx, cy + (dx ? -34 : -50), 7, 0, 7); g.fill(); } g.restore();
    piece({ x: r.x, y: r.y + 80, w: r.w, h: r.h - 80 }, "KING", { fill: ["#101014"], out: "#101014", lw: 0.5, px: 120, drips: 3, shadow: null }); g.fillStyle = "#e32b2b"; g.fillRect(r.x + 120, r.y + 238, 4, 14); g.fillRect(r.x + 360, r.y + 226, 4, 24); }
  { const r = regRect(3); g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.strokeStyle = "#35e0ff"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 11; g.shadowColor = "#35e0ff"; g.shadowBlur = 5; g.beginPath(); // marker-style tag "ZED" and a swoosh
    const x0 = r.x + 70, y0 = r.y + 70; g.moveTo(x0, y0); g.lineTo(x0 + 120, y0); g.lineTo(x0, y0 + 110); g.lineTo(x0 + 130, y0 + 110); g.moveTo(x0 + 170, y0 + 50); g.bezierCurveTo(x0 + 190, y0, x0 + 260, y0, x0 + 260, y0 + 55); g.lineTo(x0 + 175, y0 + 55); g.bezierCurveTo(x0 + 190, y0 + 125, x0 + 265, y0 + 120, x0 + 270, y0 + 100); g.moveTo(x0 + 310, y0 + 5); g.lineTo(x0 + 310, y0 + 110); g.bezierCurveTo(x0 + 400, y0 + 110, x0 + 400, y0 + 5, x0 + 310, y0 + 5); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(r.x + 40, r.y + 205); g.bezierCurveTo(r.x + 180, r.y + 160, r.x + 340, r.y + 240, r.x + 480, r.y + 186); g.stroke(); g.restore(); }
  piece(regRect(4), "NITE", { fill: ["#ff7ae0", "#7a5bff"], out: "#100820", shadow: "#ff3c8f", depth: 6, rot: -0.03, drips: 5, lw: 9 });
  { const r = regRect(5); g.save(); g.translate(r.x + 130, r.y + 128); g.fillStyle = "#101014"; const star = (rad) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? rad * 0.42 : rad; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }; star(96); g.fillStyle = "#ffd23a"; star(70); g.restore();
    g.fillStyle = "#101014"; g.fillRect(r.x + 300, r.y + 120, 70, 120); g.fillRect(r.x + 318, r.y + 96, 34, 28); g.fillStyle = "#e32b2b"; g.fillRect(r.x + 300, r.y + 160, 70, 26); g.fillStyle = "#101014"; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(r.x + 335 + (k - 3) * 11, r.y + 78 - Math.abs(k - 3) * 6, 3.5, 0, 7); g.fill(); } }
  piece(regRect(6), "SK8", { fill: ["#ffd84a", "#ff5a2a"], out: "#1c0a06", shadow: "#6a1a10", rot: 0.07, depth: 4, drips: 5 });
  { const r = regRect(7); g.save(); g.fillStyle = "#ff3a6a"; g.strokeStyle = "#1a0710"; g.lineWidth = 10; g.translate(r.x + 256, r.y + 100); g.beginPath(); g.moveTo(0, 60); g.bezierCurveTo(-120, -20, -50, -90, 0, -30); g.bezierCurveTo(50, -90, 120, -20, 0, 60); g.closePath(); g.stroke(); g.fill(); g.restore(); piece({ x: r.x, y: r.y + 150, w: r.w, h: 100 }, "S + R", { fill: ["#ffffff", "#ffc0d0"], out: "#1a0710", px: 80, drips: 3 }); }
  piece(regRect(8), "BOMBAY", { fill: ["#7cff9a", "#10b86a"], out: "#06180e", shadow: "#06180e", depth: 4, skew: -0.1, drips: 9, px: 120 });
  piece(regRect(9), "VIBES", { fill: ["#ff3d7f", "#ff8a2d", "#ffe34a", "#7cff6b", "#35e0ff"], out: "#0b0616", shadow: "#0b0616", depth: 4, rot: 0.03, skew: -0.08, drips: 8, lw: 11 });
  piece(regRect(10), "DRIFT", { fill: ["#9ff6ff", "#2a7bff"], out: "#071433", shadow: "#071433", depth: 5, skew: -0.2, rot: -0.02, drips: 6 });
  // ---- Midnight Burn crew pieces -----------------------------------------------------------------------------------------------------------
  const flame = (x, y, s, c1, c2) => { g.save(); g.translate(x, y); g.scale(s, s); const gr = g.createLinearGradient(0, 0, 0, -90); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.strokeStyle = "#0a0612"; g.lineWidth = 7; g.lineJoin = "round"; g.beginPath(); g.moveTo(-26, 0); g.bezierCurveTo(-40, -30, -10, -50, -14, -86); g.bezierCurveTo(10, -66, 8, -48, 20, -40); g.bezierCurveTo(28, -52, 24, -64, 30, -76); g.bezierCurveTo(52, -40, 40, -10, 26, 0); g.closePath(); g.stroke(); g.fill(); g.restore(); };
  { const r = mbRect(0); // 1: big bubble letters over a banner
    piece({ x: r.x, y: r.y - 14, w: r.w, h: 190 }, "MIDNIGHT BURN", { fill: ["#ff5ad0", "#ff8a2d", "#ffe34a"], out: "#0b0616", shadow: "#2a0a4a", depth: 5, rot: -0.025, px: 170, fit: 0.9, drips: 10, lw: 12 });
    g.save(); g.fillStyle = "#0b0616"; g.beginPath(); g.moveTo(r.x + 300, r.y + 188); g.lineTo(r.x + 724, r.y + 188); g.lineTo(r.x + 746, r.y + 218); g.lineTo(r.x + 724, r.y + 248); g.lineTo(r.x + 300, r.y + 248); g.lineTo(r.x + 278, r.y + 218); g.closePath(); g.fill(); g.restore();
    g.font = FONT(46); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#35e0ff"; g.fillText("MUMBAI", r.x + 512, r.y + 220);
    flame(r.x + 90, r.y + 222, 0.85, "#ff5a1a", "#ffe34a"); flame(r.x + 935, r.y + 222, 0.85, "#ff5a1a", "#ffe34a"); g.fillStyle = "#f2f6ff"; g.strokeStyle = "#0b0616"; g.lineWidth = 5; g.beginPath(); g.arc(r.x + 46, r.y + 150, 26, Math.PI * 0.3, Math.PI * 1.7, false); g.arc(r.x + 58, r.y + 146, 21, Math.PI * 1.6, Math.PI * 0.4, true); g.closePath(); g.stroke(); g.fill(); }
  { const r = mbRect(1); // 2: crew monogram, a racing car in speed lines and the name
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.strokeStyle = "#35e0ff"; g.lineCap = "round"; for (let i = 0; i < 9; i++) { g.globalAlpha = 0.55; g.lineWidth = 3 + (i % 3) * 2; const y = r.y + 148 + i * 11; g.beginPath(); g.moveTo(r.x + 560 + (i % 4) * 30, y - 24); g.lineTo(r.x + 760 + (i % 3) * 40, y - 24); g.stroke(); } g.globalAlpha = 1; g.restore();
    piece({ x: r.x, y: r.y, w: 330, h: 256 }, "MB", { fill: ["#ffffff", "#ff4ab0"], out: "#0b0616", shadow: "#35e0ff", depth: 5, px: 200, fit: 0.9, drips: 4, lw: 13, rot: -0.04 });
    // car side view
    g.save(); g.translate(r.x + 560, r.y + 36); g.fillStyle = "#ff3a9a"; g.strokeStyle = "#0b0616"; g.lineWidth = 8; g.lineJoin = "round"; g.beginPath(); g.moveTo(0, 90); g.lineTo(0, 66); g.bezierCurveTo(30, 58, 70, 24, 140, 20); g.bezierCurveTo(190, 18, 220, 44, 270, 52); g.lineTo(330, 60); g.bezierCurveTo(350, 66, 356, 80, 354, 90); g.closePath(); g.stroke(); g.fill();
    g.fillStyle = "#101820"; g.beginPath(); g.moveTo(110, 56); g.bezierCurveTo(130, 30, 170, 28, 196, 54); g.closePath(); g.fill(); g.fillStyle = "#0b0616"; for (const wx of [78, 280]) { g.beginPath(); g.arc(wx, 96, 26, 0, 7); g.fill(); g.fillStyle = "#e8eef8"; g.beginPath(); g.arc(wx, 96, 11, 0, 7); g.fill(); g.fillStyle = "#0b0616"; } g.restore();
    piece({ x: r.x + 330, y: r.y + 172, w: 694, h: 84 }, "MIDNIGHT BURN MUMBAI", { fill: ["#ffe34a", "#ff8a2d"], out: "#0b0616", px: 66, fit: 0.97, drips: 6, lw: 6, shadow: null }); }
  { const r = mbRect(2); // 3: stencil — moon in a ring of flame, crisp black and white with one spot colour
    g.save(); g.translate(r.x + 150, r.y + 128); g.fillStyle = "#0b0616"; g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fill(); g.fillStyle = "#f2f6ff"; g.beginPath(); g.arc(0, 0, 80, 0, 7); g.fill(); g.fillStyle = "#0b0616"; g.beginPath(); g.arc(26, -10, 66, 0, 7); g.fill(); g.restore();
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.62 + i * 0.095); flame(r.x + 150 + Math.cos(a) * 112, r.y + 128 + Math.sin(a) * 112 + 36, 0.42, "#ff5a1a", "#ffe34a"); }
    piece({ x: r.x + 290, y: r.y + 18, w: 720, h: 120 }, "MIDNIGHT BURN", { fill: ["#f2f6ff"], out: "#0b0616", px: 112, fit: 0.97, lw: 9, drips: 5, shadow: null });
    piece({ x: r.x + 290, y: r.y + 140, w: 720, h: 100 }, "MUMBAI", { fill: ["#35e0ff"], out: "#0b0616", px: 92, fit: 0.6, lw: 8, drips: 3, shadow: null, dx: -80 }); }
  // ---- weathering: the paint is not perfect — flake it with the grain of the wall, fade it a little
  const im = g.getImageData(0, 0, AW, AH), d = im.data; for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const i = (y * AW + x) * 4 + 3; if (d[i] === 0) continue; const n = (Math.sin(x * 0.7) * Math.sin(y * 0.9) * 0.5 + 0.5) * 0.18 + (rnd() < 0.035 ? 0.55 : 0); d[i] = Math.max(0, d[i] * (0.93 - n)); } g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
