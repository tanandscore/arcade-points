// Threefold levels. Built with a tiny drawing helper; rows are counted from the bottom (row 0 = lowest).
// Legend: # solid  W breakable wall  ^ spikes  P start  > exit  o spark  h life crystal  C crate  e walker  s archer-bot
//         1 2 3 pressure plates   ! @ % doors (open while their plate is pressed / target was shot)   x y z shoot-targets (open door 1 2 3 for a while)
function mk(W, H = 16) {
  const g = Array.from({ length: H }, () => Array(W).fill("."));
  const o = { W, H, lifts: [],
    set(c, r, ch) { if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = ch; return o; },
    rect(c0, r0, c1, r1, ch) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) o.set(c, r, ch); return o; },
    many(ch, pts) { pts.forEach(([c, r]) => o.set(c, r, ch)); return o; },
    pit(c0, c1) { o.rect(c0, 0, c1, 2, "."); o.rect(c0, 0, c1, 0, "^"); return o; },
    lift(cx, y0, cx1, y1, w, speed = 2.4, plate = 0) { o.lifts.push({ x0: cx, y0, x1: cx1, y1, w, speed, plate }); return o; },
    out() { return g.map((r) => r.join("")).reverse(); } };
  o.rect(0, 0, W - 1, 2, "#"); return o;
}
const finish = (m, d) => ({ ...d, W: m.W, H: m.H, grid: m.out(), lifts: m.lifts });

function l1() {
  const m = mk(64); m.set(3, 3, "P").set(10, 3, "C").set(17, 3, "C").set(13, 3, "#").rect(20, 3, 21, 4, "#").set(27, 3, "e");
  m.pit(32, 34).rect(40, 3, 41, 3, "#").rect(42, 3, 43, 4, "#").rect(44, 3, 63, 5, "#").set(52, 6, "e").set(60, 6, ">");
  m.many("o", [[8, 4], [14, 5], [22, 5], [23, 5], [26, 5], [28, 5], [32, 6], [33, 6], [46, 7], [50, 7], [55, 7]]).set(38, 4, "h");
  return finish(m, { name: "Mossgate", sub: "Learn to walk, push and swing", theme: 0, par: 80, tip: "A D to walk, Space to jump. Push the crate to the wall and climb on it. Left click swings the Warden's sword." });
}
function l2() {
  const m = mk(76); m.set(3, 3, "P").rect(14, 3, 15, 5, "#").set(26, 3, "1").set(25, 3, "C").rect(30, 3, 30, 6, "!").pit(36, 40);
  m.rect(48, 6, 53, 6, "#").set(44, 3, "e").set(60, 3, "e").rect(64, 3, 65, 5, "#").set(72, 3, ">");
  m.many("o", [[8, 4], [14, 7], [15, 7], [20, 5], [26, 5], [38, 6], [39, 6], [49, 7], [51, 7], [53, 7], [58, 5], [68, 7]]).set(34, 4, "h");
  return finish(m, { name: "Wisp Hollow", sub: "Conjure crates with the Wisp", theme: 1, par: 110, tip: "Press 2 for the Wisp. Left click conjures a crate (up to 3). Hold right click to drag crates with your mind. Stack crates into stairs to climb the wall, then push the crate onto the plate." });
}
function l3() {
  const m = mk(80); m.set(3, 3, "P").set(20, 8, "x").rect(26, 3, 26, 6, "!");
  m.rect(29, 3, 29, 3, "#").rect(30, 3, 30, 4, "#").rect(31, 3, 36, 5, "#").set(34, 6, "s").set(36, 6, "s");
  m.rect(37, 3, 43, 5, "#").pit(44, 56).set(62, 3, "e").set(66, 3, "e").rect(70, 3, 70, 6, "@").set(66, 9, "y");
  m.set(62, 3, "e").set(76, 3, ">");
  m.many("o", [[8, 4], [14, 5], [22, 5], [28, 5], [33, 8], [40, 8], [48, 9], [52, 9], [60, 5], [64, 5], [73, 5]]).set(45, 8, "h");
  return finish(m, { name: "Archer's Pass", sub: "Shoot targets, glide over the chasm", theme: 2, par: 120, tip: "Press 3 for the Archer. Hold left click to draw, release to shoot at the cursor. Shoot the glowing target to open the door. Hold Space in the air to glide." });
}
function l4() {
  const m = mk(88); m.set(3, 3, "P").rect(14, 3, 15, 4, "W").set(20, 3, "C").set(24, 3, "1").rect(34, 3, 34, 7, "!");
  m.set(40, 3, "e").set(43, 3, "e").set(46, 3, "e").rect(52, 3, 55, 5, "#").set(54, 6, "s").pit(60, 67);
  m.set(74, 10, "z").rect(78, 3, 78, 6, "%").rect(82, 3, 83, 4, "W").set(86, 3, ">");
  m.many("o", [[8, 4], [17, 5], [18, 4], [29, 5], [38, 5], [48, 5], [53, 8], [62, 6], [64, 6], [70, 5], [80, 5], [84, 6]]).set(56, 8, "h");
  return finish(m, { name: "Cinder Bridge", sub: "Break walls, press plates, fight on", theme: 3, par: 150, tip: "The Warden's sword smashes cracked walls. Push crates onto plates. Hold right click with the Warden to raise the shield against arrows." });
}
function l5() {
  const m = mk(84); m.set(3, 3, "P").rect(17, 8, 28, 8, "#").set(22, 9, "e");
  m.rect(29, 0, 44, 2, ".").rect(29, 0, 44, 0, "^").rect(44, 8, 52, 8, "#").set(46, 9, "s");
  m.rect(62, 11, 70, 11, "#").set(70, 12, "x").rect(74, 3, 74, 8, "!").set(80, 3, ">").set(56, 3, "e").set(66, 3, "e");
  m.lift(15, 3, 15, 9, 2, 2.6, 0).lift(31, 9, 42, 9, 3, 3.2, 0).lift(60, 3, 60, 12, 2, 2.4, 0);
  m.many("o", [[8, 4], [20, 10], [25, 10], [36, 11], [48, 10], [50, 10], [58, 5], [64, 13], [67, 13], [77, 5]]).set(68, 13, "h");
  return finish(m, { name: "Clockwork Lifts", sub: "Ride the lifts, mind the spikes", theme: 4, par: 160, tip: "The lifts run on their own: wait for one to arrive, step on, ride, and step off at the top. Shoot the target to open the last door." });
}
function l6() {
  const m = mk(100); m.set(3, 3, "P").rect(10, 3, 11, 4, "W").set(14, 3, "e").set(17, 3, "e").set(21, 3, "s").rect(28, 3, 29, 5, "#");
  m.pit(36, 44).set(54, 10, "x").rect(62, 3, 62, 8, "!").set(48, 3, "s").set(58, 3, "s");
  m.set(64, 3, "C").set(70, 3, "2").set(72, 3, "e").rect(74, 3, 74, 7, "@").rect(76, 3, 79, 3, "#").pit(80, 86).set(97, 3, ">");
  m.lift(38, 3, 43, 3, 3, 3.0, 0);
  m.many("o", [[8, 4], [13, 5], [19, 5], [25, 5], [31, 8], [40, 5], [50, 5], [57, 5], [66, 5], [71, 5], [78, 7], [86, 9], [90, 9], [95, 5]]).set(33, 4, "h").set(67, 4, "h");
  return finish(m, { name: "The Hollow King's Road", sub: "Everything you have learned", theme: 5, par: 220, tip: "Swap heroes with 1, 2 and 3. Every obstacle has an answer: sword, crates, arrows or a glide. Life crystals revive fallen heroes." });
}
export const LEVELS = [l1(), l2(), l3(), l4(), l5(), l6()];
