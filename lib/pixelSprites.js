// Genuine pixel-grid sprites — each one is a small 2D grid where
// every cell is either transparent or a specific color, drawn onto a
// canvas at a chunky scale (each "pixel" becomes an actual block of
// several real pixels). This is the real technique pixel art uses;
// the difference from hand-drawn game art is that these grids are
// defined in code rather than painted by an artist, so the shapes
// are simple and geometric rather than expressive. That's an honest
// tradeoff, not a hidden one.
//
// Grid format: array of rows, each row a string where each character
// maps to a color in the palette (or " " for transparent).

const PLAYER_SPRITE = {
  palette: { c: "#3ee6e0", d: "#1a8f8a", e: "#ffe14d", s: "#e8d9c0" },
  grid: [
    " cccc ",
    "cdcccd",
    "cdcccd",
    "csssss",
    "ceceec",
    " c  c ",
    " c  c ",
  ],
};

const BAT_SPRITE = {
  palette: { b: "#8a5cff", e: "#ffe14d", w: "#5a2fd6" },
  grid: [
    "w   w",
    "wb bw",
    " bbb ",
    "webew",
    " bbb ",
  ],
};

const ZOMBIE_SPRITE = {
  palette: { g: "#6bff6b", d: "#2e8a2e", e: "#ff3ea5" },
  grid: [
    " gggg ",
    "gdgggd",
    "gdgggd",
    "gggggg",
    "geggeg",
    " g  g ",
  ],
};

const SKELETON_SPRITE = {
  palette: { w: "#e8e2d6", k: "#9a9488", e: "#3ee6e0" },
  grid: [
    " wwww ",
    "wkwwkw",
    "wewwew",
    "wwwwww",
    " wkkw ",
    " w  w ",
  ],
};

const REAPER_SPRITE = {
  palette: { p: "#2a1a40", a: "#ff3ea5", e: "#ffe14d" },
  grid: [
    "pp  pp",
    "ppppp",
    "pappap",
    "ppppp",
    "peeeep",
    "p    p",
    "p    p",
  ],
};

// --- Starfall Overrun's roster ---
const HUNTER_SPRITE = {
  palette: { m: "#c9c9d6", d: "#6b6b80", e: "#ffb703", v: "#3ee6e0" },
  grid: [
    " mmmm ",
    "mdmmdm",
    "mvmmvm",
    "meeeem",
    " m  m ",
    " m  m ",
  ],
};

const DRONE_SPRITE = {
  palette: { s: "#9a9ad6", e: "#ff3ea5" },
  grid: [
    "s s s",
    "sssss",
    " ses ",
    "sssss",
  ],
};

const CRAWLER_SPRITE = {
  palette: { p: "#b45cff", d: "#6b2fa0", e: "#3ee6e0" },
  grid: [
    " pppp ",
    "pdpppd",
    "peppep",
    " pppp ",
    "p p p ",
  ],
};

const BEHEMOTH_SPRITE = {
  palette: { g: "#6b6b80", d: "#3a3a4a", e: "#ff5a3c" },
  grid: [
    " gggggg ",
    "gdggggdg",
    "gegggeg",
    "gggggggg",
    "gggggggg",
    " g g gg ",
  ],
};

const VOID_TITAN_SPRITE = {
  palette: { v: "#1a0f3d", a: "#ff3ea5", e: "#ffe14d" },
  grid: [
    "vv    vv",
    "vvv  vvv",
    "vvvvvvvv",
    "vaavvaav",
    "vvvvvvvv",
    " veeeeev",
    " v     v",
    " v     v",
  ],
};

// --- Arcane Survivor's roster ---
const ARCANIST_SPRITE = {
  palette: { r: "#b45cff", g: "#ffd700", s: "#e8d9c0", e: "#3ee6e0" },
  grid: [
    " rrrr ",
    "rgrrgr",
    "rerrer",
    "rggggr",
    " r  r ",
    " r  r ",
  ],
};

const IMP_SPRITE = {
  palette: { d: "#ff5a3c", k: "#8a1f0f", e: "#ffe14d" },
  grid: [
    "d d d",
    "ddddd",
    "kekek",
    " ddd ",
    "d   d",
  ],
};

const GHOUL_SPRITE = {
  palette: { g: "#8a6a3c", d: "#4a3a1c", e: "#ff3ea5" },
  grid: [
    " gggg ",
    "gdgggd",
    "geggeg",
    "gggggg",
    " g  g ",
    " g  g ",
  ],
};

const HOUNDWRAITH_SPRITE = {
  palette: { p: "#3a1a5c", e: "#3ee6e0" },
  grid: [
    "p    p",
    "pp  pp",
    "peeeep",
    "ppppppp",
    "p p p p",
  ],
};

const GUARDIAN_SPRITE = {
  palette: { s: "#9aa0a6", d: "#4a4e54", e: "#b45cff" },
  grid: [
    " ssssss ",
    "sdssssds",
    "sesssses",
    "ssssssss",
    "ssssssss",
    " ss ss  ",
    " s   s  ",
  ],
};

// --- Arena Survivor's roster — dark sci-fi / neon themed ---
const TROOPER_SPRITE = {
  palette: { g: "#3ee6e0", d: "#1a4a48", e: "#ffb703", s: "#c9c9d6" },
  grid: [
    " gggg ",
    "gdgggd",
    "gsggsg",
    "geggeg",
    " g  g ",
    " g  g ",
  ],
};

const CHARGER_SPRITE = {
  palette: { r: "#ff3ea5", d: "#8a1f5c", e: "#ffe14d" },
  grid: [
    " r  r ",
    "rrrrrr",
    "rdered",
    "rrrrrr",
    " r  r ",
  ],
};

const TANK_SPRITE = {
  palette: { m: "#6b6b80", d: "#3a3a4a", e: "#3ee6e0" },
  grid: [
    "mmmmmmmm",
    "mdmmmmdm",
    "memmmmem",
    "mmmmmmmm",
    "mmmmmmmm",
    "mm mm mm",
  ],
};

const EXPLODER_SPRITE = {
  palette: { o: "#ffb703", d: "#a85f00", e: "#ff3ea5" },
  grid: [
    " oooo ",
    "odoodo",
    "oeoooe",
    " oooo ",
    "  oo  ",
  ],
};

const ARENA_GUARDIAN_SPRITE = {
  palette: { s: "#9aa0a6", d: "#4a4e54", e: "#ff3ea5" },
  grid: [
    " ssssssss ",
    "sdssssssds",
    "sesssssses",
    "ssssssssss",
    "ssssssssss",
    " ss ss ss ",
    " s   s   s",
  ],
};

const VOID_OVERLORD_SPRITE = {
  palette: { v: "#1a0f3d", a: "#b45cff", e: "#ffe14d" },
  grid: [
    "vv    vv",
    "vvaavvvv",
    "vvvvvvvv",
    "vaaaaaav",
    "vvvvvvvv",
    " veeeeev",
    " v v v v",
  ],
};

export const SPRITES = {
  player: PLAYER_SPRITE,
  bat: BAT_SPRITE,
  zombie: ZOMBIE_SPRITE,
  skeleton: SKELETON_SPRITE,
  reaper: REAPER_SPRITE,
  hunter: HUNTER_SPRITE,
  drone: DRONE_SPRITE,
  crawler: CRAWLER_SPRITE,
  behemoth: BEHEMOTH_SPRITE,
  voidtitan: VOID_TITAN_SPRITE,
  arcanist: ARCANIST_SPRITE,
  imp: IMP_SPRITE,
  ghoul: GHOUL_SPRITE,
  houndwraith: HOUNDWRAITH_SPRITE,
  guardian: GUARDIAN_SPRITE,
  trooper: TROOPER_SPRITE,
  charger: CHARGER_SPRITE,
  tank: TANK_SPRITE,
  exploder: EXPLODER_SPRITE,
  arenaguardian: ARENA_GUARDIAN_SPRITE,
  voidoverlord: VOID_OVERLORD_SPRITE,
};

// Draws a sprite centered at (x, y) in canvas pixel coordinates, each
// grid cell rendered as a `cell` x `cell` block.
export function drawSprite(ctx, spriteKey, x, y, cell, flip) {
  const sprite = SPRITES[spriteKey];
  if (!sprite) return;
  const rows = sprite.grid;
  const cols = rows[0].length;
  const width = cols * cell;
  const height = rows.length * cell;
  const startX = x - width / 2;
  const startY = y - height / 2;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      const col = flip ? cols - 1 - c : c;
      const ch = rows[r][col];
      if (ch === " ") continue;
      const color = sprite.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(startX + c * cell), Math.round(startY + r * cell), cell, cell);
    }
  }
}
