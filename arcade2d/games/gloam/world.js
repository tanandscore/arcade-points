// Gloamreach — the world map. One big connected map made of 20x12-tile rooms. Rooms are built with code so doors always line up.
import { Grid } from "../../core/lvl";
export const RW = 20, RH = 12, COLS = 5, ROWS = 4, TS = 48;
export const BOSS_NEEDED = 3;
export const THEMES = {
  moss: { name: "Mossgate", sky: ["#0e2a22", "#1f4a3a"], rock: "#2b4638", top: "#5fae6a", glow: "#9bffb0", far: "#143a2c", mid: "#1b4d39" },
  cave: { name: "Sunken Caves", sky: ["#0a1830", "#16365c"], rock: "#26405e", top: "#4aa0c8", glow: "#7fe0ff", far: "#0f2a4a", mid: "#17395f" },
  crystal: { name: "Crystal Spires", sky: ["#1d1038", "#3b1f6e"], rock: "#3d2c6b", top: "#b48cff", glow: "#e0b8ff", far: "#2a1a52", mid: "#35236a" },
  ember: { name: "Ember Forge", sky: ["#2a0e0a", "#5a1f12"], rock: "#4a2418", top: "#ff9a4a", glow: "#ffb060", far: "#3a150d", mid: "#4f2113" },
  gloam: { name: "The Gloam Heart", sky: ["#0a0414", "#220a33"], rock: "#2a1740", top: "#c04aff", glow: "#e070ff", far: "#180828", mid: "#24103a" },
};
export const BOSSES = {
  lanternjaw: { name: "Lanternjaw", hp: 36, reward: "dash" },
  mossback: { name: "Mossback", hp: 44, reward: "wall" },
  cinderwyrm: { name: "Cinderwyrm", hp: 52, reward: "power" },
  gloamheart: { name: "The Gloam Heart", hp: 120, reward: null },
};
export const ABILITIES = { dj: ["Double Jump", "Press jump again in the air."], dash: ["Air Dash", "Press C, L or Shift to dash. It smashes cracked amber blocks."], wall: ["Wall Cling", "Slide down walls and jump off them to climb."], power: ["Overcharge", "Your shots hit twice as hard and pierce enemies."] };

export function buildWorld() {
  const g = new Grid(RW * COLS, RH * ROWS, "#"), ents = [], rooms = {};
  const room = (c, r, doors, theme, name, fn) => {
    const ox = c * RW, oy = r * RH, R = (rt) => ({ ox, oy });
    g.rect(ox + 1, oy + 1, ox + 18, oy + 10, "."); // interior
    if (doors.includes("L")) g.rect(ox, oy + 8, ox, oy + 10, "."); if (doors.includes("R")) g.rect(ox + 19, oy + 8, ox + 19, oy + 10, ".");
    if (doors.includes("T")) g.rect(ox + 8, oy, ox + 11, oy, "="); if (doors.includes("B")) g.rect(ox + 8, oy + 11, ox + 11, oy + 11, "=");
    const A = {
      c, r, ox, oy, theme, name, doors,
      rect: (x0, y0, x1, y1, ch = "#") => g.rect(ox + x0, oy + y0, ox + x1, oy + y1, ch),
      plank: (x0, x1, y) => g.plank(ox + x0, ox + x1, oy + y), spikes: (x0, x1, y) => g.spikes(ox + x0, ox + x1, oy + y), put: (x, y, ch) => g.put(ox + x, oy + y, ch),
      e: (t, lx, ly, o = {}) => { const e = { t, room: `${c},${r}`, x: (ox + lx + 0.5) * TS, y: (oy + ly + 1) * TS, ...o }; ents.push(e); return e; },
      // a climbable zig-zag of planks up to the ceiling door (every step is two tiles up)
      chain: (rows = [9, 7, 5, 3, 1], x = 0) => { rows.forEach((y, i) => { const a = i % 2 ? 8 : 3, b = i % 2 ? 14 : 9; g.plank(ox + a + x, ox + b + x, oy + y); }); g.plank(ox + 6, ox + 11, oy + 1); },
      // a narrow stone shaft in the middle of the room (for wall climbing)
      shaft: (y0 = 1, y1 = 8) => { g.rect(ox + 1, oy + y0, ox + 8, oy + y1, "#"); g.rect(ox + 12, oy + y0, ox + 18, oy + y1, "#"); },
    };
    rooms[`${c},${r}`] = A; fn && fn(A); return A;
  };
  const sign = (A, x, y, text) => A.e("sign", x, y, { text });
  const spark = (A, x, y, id) => A.e("spark", x, y, { id });
  const life = (A, x, y, id) => A.e("life", x, y, { id });

  const pocket = (A, side, kind, id, itemT = "life") => { // a sealed little alcove in the right wall with a breakable plug (b = shoot it, d = dash it)
    if (side === "R") { A.rect(15, 7, 18, 8, "#"); A.rect(16, 9, 18, 10, "."); A.put(15, 9, kind); A.put(15, 10, kind); A.e(itemT, 17, 10, { id }); }
    else { A.rect(1, 7, 4, 8, "#"); A.rect(1, 9, 3, 10, "."); A.put(4, 9, kind); A.put(4, 10, kind); A.e(itemT, 2, 10, { id }); }
  };
  const chain2 = (A, left = false) => { const rows = [9, 7, 5, 3, 1]; rows.forEach((y, i) => { const a = i % 2 ? (left ? 6 : 8) : (left ? 2 : 3), b = i % 2 ? (left ? 11 : 14) : (left ? 7 : 9); A.plank(a, b, y); }); A.plank(6, 11, 1); };
  // ---------------------------------------------------------------- Mossgate
  room(0, 2, "RT", "moss", "Landing", (A) => {
    A.shaft(1, 8); A.rect(9, 1, 11, 8, "."); // a 3-wide shaft in the middle goes up to the Cinder Shaft
    A.e("save", 3, 10, { id: "m1" }); sign(A, 5, 10, "Arrow keys or A D move. Space jumps. X fires your lantern-gun."); A.e("walker", 15, 10);
  });
  room(1, 2, "LRT", "moss", "Hollow Path", (A) => {
    chain2(A); A.e("walker", 14, 10); A.e("walker", 4, 10); A.spikes(12, 13, 10); sign(A, 2, 10, "Cracked grey blocks break when you shoot them."); pocket(A, "R", "b", "lf_m2"); A.plank(2, 5, 7); spark(A, 3, 6, "sp_m1");
  });
  room(2, 2, "LR", "moss", "Spore Hall", (A) => {
    A.spikes(9, 11, 10); A.plank(3, 7, 9); A.plank(6, 10, 7); A.plank(9, 13, 5); spark(A, 12, 4, "sp_m3");
    A.e("flyer", 6, 3); A.e("flyer", 12, 3); A.e("walker", 13, 10); A.e("walker", 3, 10); pocket(A, "R", "b", "lf_m3");
  });
  room(1, 1, "BT", "moss", "Whispering Climb", (A) => { chain2(A); A.e("flyer", 4, 4); A.e("flyer", 16, 6); A.plank(15, 18, 5); spark(A, 16, 4, "sp_m4"); });
  room(1, 0, "BR", "moss", "Lantern Rest", (A) => {
    A.e("save", 4, 10, { id: "m5" }); A.e("pedestal", 16, 10, { id: "dj" }); A.e("walker", 13, 10); A.plank(2, 5, 9); spark(A, 3, 8, "sp_m5"); sign(A, 6, 10, "Something hums on the far side.");
  });
  // ------------------------------------------------------------ Sunken Caves
  room(3, 2, "LTB", "cave", "Sunken Gate", (A) => {
    A.plank(4, 9, 8); A.plank(9, 14, 5); A.plank(6, 11, 2); A.e("flyer", 14, 7); A.e("walker", 3, 10); A.e("walker", 16, 10); spark(A, 9, 1, "sp_s1");
    sign(A, 5, 10, "Those ledges are too high for a normal jump.");
  });
  room(3, 3, "TR", "cave", "Flooded Dark", (A) => {
    chain2(A, true); A.spikes(12, 16, 10); A.rect(18, 8, 18, 10, "d"); A.e("flyer", 12, 5); A.e("walker", 3, 10); A.e("turret", 17, 10); spark(A, 9, 2, "sp_s2");
  });
  room(4, 3, "LT", "cave", "Echo Burrow", (A) => {
    chain2(A); A.plank(2, 6, 7); spark(A, 4, 6, "sp_s3"); A.e("walker", 12, 10); A.e("flyer", 5, 4); pocket(A, "R", "d", "lf_s3");
  });
  room(4, 2, "B", "cave", "Mossback's Den", (A) => { A.e("boss", 15, 10, { id: "mossback" }); A.e("arena", 0, 0); pocket(A, "L", "d", "sp_s4", "spark"); });
  // ---------------------------------------------------------- Crystal Spires
  room(3, 1, "BR", "crystal", "Prism Landing", (A) => { A.e("flyer", 6, 4); A.e("walker", 14, 10); A.e("walker", 4, 10); A.plank(14, 17, 9); spark(A, 16, 8, "sp_c1"); });
  room(4, 1, "LT", "crystal", "Glass Bridge", (A) => {
    chain2(A); A.plank(2, 6, 7); spark(A, 4, 6, "sp_c2"); A.e("flyer", 5, 3); A.e("flyer", 15, 4); A.e("turret", 13, 10); pocket(A, "R", "d", "lf_c2");
  });
  room(4, 0, "BL", "crystal", "Spire Top", (A) => { A.e("flyer", 6, 4); A.e("flyer", 14, 4); A.plank(3, 7, 9); A.plank(11, 15, 9); spark(A, 13, 8, "sp_c3"); A.e("turret", 17, 10); });
  room(3, 0, "R", "crystal", "Lanternjaw's Pool", (A) => { A.e("boss", 9, 4, { id: "lanternjaw" }); A.plank(3, 6, 9); A.plank(13, 16, 9); A.e("arena", 0, 0); });
  // ------------------------------------------------------------- Ember Forge
  room(0, 1, "BT", "ember", "Cinder Shaft", (A) => {
    A.shaft(1, 10); A.rect(9, 1, 11, 10, "."); A.spikes(9, 9, 5); A.spikes(11, 11, 7); A.spikes(9, 9, 9);
    A.rect(13, 5, 14, 6, "."); A.put(12, 5, "b"); A.put(12, 6, "b"); A.e("life", 13, 6, { id: "lf_f1" });
  });
  room(0, 0, "B", "ember", "Cinderwyrm's Forge", (A) => { A.e("boss", 14, 10, { id: "cinderwyrm" }); A.plank(2, 6, 9); A.plank(12, 16, 9); A.plank(7, 11, 7); spark(A, 9, 6, "sp_f2"); A.e("arena", 0, 0); });
  // ------------------------------------------------------------- Gloam Heart
  room(2, 0, "L", "gloam", "The Gloam Heart", (A) => { A.e("boss", 10, 6, { id: "gloamheart" }); A.plank(2, 6, 9); A.plank(13, 17, 9); A.plank(7, 12, 7); A.e("arena", 0, 0); });
  // gate in the door between Lantern Rest and the Gloam Heart
  const gx0 = 1 * RW + 19, gx1 = 2 * RW; for (const x of [gx0, gx1]) g.rect(x, 8, x, 10, "G");

  return { grid: g, rows: g.rows(), ents, rooms, W: RW * COLS, H: RH * ROWS };
}
