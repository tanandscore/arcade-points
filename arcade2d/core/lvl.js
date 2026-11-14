// A tiny level-building helper: draw a level with code instead of typing rows by hand. Coordinates are tiles (x across, y down).
// Stand-on rule: an entity written on row y stands on the solid tile in row y+1.
export class Grid {
  constructor(w, h = 14, fill = ".") { this.w = w; this.h = h; this.c = Array.from({ length: h }, () => Array(w).fill(fill)); }
  put(x, y, ch) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.c[y][x] = ch; return this; }
  get(x, y) { return this.c[y] && this.c[y][x]; }
  rect(x0, y0, x1, y1, ch = "#") { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(x, y, ch); return this; }
  // ground from x0..x1 whose top is row y (filling down to the bottom)
  floor(x0, x1, y, ch = "#") { return this.rect(x0, y, x1, this.h - 1, ch); }
  // dig a pit
  pit(x0, x1, y = 0) { return this.rect(x0, y, x1, this.h - 1, "."); }
  // thin one-way plank
  plank(x0, x1, y) { return this.rect(x0, y, x1, y, "="); }
  // a ceiling slab
  ceil(x0, x1, y1 = 1, ch = "X") { return this.rect(x0, 0, x1, y1, ch); }
  wall(x, y0, y1, ch = "X") { return this.rect(x, y0, x, y1, ch); }
  spikes(x0, x1, y) { return this.rect(x0, y, x1, y, "^"); }
  many(ch, ...pts) { for (const [x, y] of pts) this.put(x, y, ch); return this; }
  coins(x0, x1, y) { for (let x = x0; x <= x1; x++) this.put(x, y, "c"); return this; }
  rows() { return this.c.map((r) => r.join("")); }
}
