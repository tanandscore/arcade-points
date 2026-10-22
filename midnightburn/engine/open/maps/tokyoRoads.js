// Midnight Burn: Tokyo Drift — the authored roads. Points are [latitude, longitude]; roads.js turns them into map metres with ll().
// Expressways are left un-grounded: like the Mumbai highways they climb onto viaducts through built-up districts and over water, and stay on the ground in the countryside.
import { ll, RIVERS, LLs } from "./tokyoGeo";
import { isWater, shoreDist, inAirport, W } from "../geo";

// a mountain road of hairpins: n points from A to B, swinging left and right of the straight line by `amp` degrees
function zig(la0, lo0, la1, lo1, n, amp) {
  const out = [], dx = lo1 - lo0, dy = la1 - la0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), sw = i === 0 || i === n - 1 ? 0 : (i % 2 ? 1 : -1) * amp; out.push([la0 + dy * t + ny * sw, lo0 + dx * t + nx * sw]); }
  return out;
}

// the same hairpin road, drawn straight in map metres (used where the real place falls in the sea of this squeezed map)
function zigM(x0, z0, x1, z1, n, amp) {
  const out = [], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), sw = i === 0 || i === n - 1 ? 0 : (i % 2 ? 1 : -1) * amp; out.push([x0 + dx * t + nx * sw, z0 + dz * t + nz * sw]); }
  return out;
}

export const TOKYO_ROADS = [
  // ---- the Shuto Expressway: the inner loop and the radial routes ----
  { id: "c1", name: "Shuto C1 Inner Circular", cls: "hwy", loop: true, pts: [[35.6760, 139.7710], [35.6830, 139.7745], [35.6935, 139.7710], [35.6905, 139.7585], [35.6860, 139.7455], [35.6800, 139.7385], [35.6740, 139.7440], [35.6728, 139.7500], [35.6680, 139.7570], [35.6700, 139.7640], [35.6717, 139.7690], [35.6760, 139.7710]], deck: 16 },
  { id: "r1", name: "Shuto Route 1 Haneda Line", cls: "hwy", pts: [[35.6665, 139.7570], [35.6550, 139.7600], [35.6400, 139.7570], [35.6280, 139.7560], [35.6000, 139.7650], [35.5780, 139.7800], [35.5560, 139.7880]], deck: 16 },
  { id: "r2", name: "Shuto Route 2 Meguro Line", cls: "hwy", pts: [[35.6680, 139.7560], [35.6560, 139.7380], [35.6410, 139.7190], [35.6240, 139.7000], [35.6050, 139.6830], [35.5780, 139.6850]], deck: 16 },
  { id: "r3", name: "Shuto Route 3 Shibuya Line & Tomei Expressway", cls: "hwy", pts: [[35.6745, 139.7385], [35.6640, 139.7200], [35.6560, 139.7005], [35.6430, 139.6830], [35.6350, 139.6560], [35.6290, 139.6320], [35.6180, 139.6000], [35.5990, 139.5550], [35.5720, 139.5000], [35.5470, 139.4530], [35.4980, 139.4050], [35.4580, 139.3500], [35.4200, 139.2800], [35.3850, 139.2100], [35.3500, 139.1200]], deck: 16 },
  { id: "r4", name: "Shuto Route 4 Shinjuku Line & Chuo Expressway", cls: "hwy", pts: [[35.6860, 139.7390], [35.6915, 139.7250], [35.6890, 139.6990], [35.6990, 139.6700], [35.6985, 139.6255], [35.6700, 139.5780], [35.6600, 139.5400], [35.6715, 139.4700], [35.6560, 139.3900], [35.6470, 139.3350], [35.6400, 139.2800], [35.6350, 139.2200], [35.6300, 139.1500]], deck: 16 },
  { id: "r5", name: "Shuto Route 5 Ikebukuro Line & Kan-etsu", cls: "hwy", pts: [[35.6905, 139.7585], [35.7135, 139.7450], [35.7295, 139.7165], [35.7512, 139.7085], [35.7950, 139.6600], [35.8500, 139.6300], [35.8800, 139.6300], [35.9300, 139.6200], [35.9800, 139.6100]], deck: 16 },
  { id: "kanetsu", name: "Kan-etsu Expressway", cls: "hwy", pts: [[35.7512, 139.6050], [35.7750, 139.5000], [35.8000, 139.4300], [35.8500, 139.4000], [35.9200, 139.3600], [35.9900, 139.3100]], deck: 14 },
  { id: "r6", name: "Shuto Route 6 Mukojima Line & Tohoku Expressway", cls: "hwy", pts: [[35.6830, 139.7745], [35.7105, 139.8015], [35.7495, 139.8050], [35.7800, 139.8000], [35.8000, 139.8400], [35.9000, 139.7800], [35.9900, 139.7600]], deck: 16 },
  { id: "r7", name: "Shuto Route 7 Komatsugawa Line & Keiyo Road", cls: "hwy", pts: [[35.6945, 139.7970], [35.6825, 139.8265], [35.6845, 139.8700], [35.7000, 139.9300], [35.6900, 139.9900], [35.6500, 140.0300], [35.6100, 140.1000], [35.5800, 140.1400], [35.5000, 140.1700]], deck: 16 },
  { id: "wangan", name: "Bayshore Route (Wangan)", cls: "hwy", scenic: true, pts: [[35.4620, 139.6930], [35.4700, 139.7050], [35.4880, 139.7380], [35.5030, 139.7660], [35.5200, 139.7870], [35.5500, 139.7990], [35.5800, 139.7960], [35.6000, 139.7910], [35.6150, 139.7900], [35.6330, 139.7970], [35.6400, 139.8300], [35.6440, 139.8600], [35.6520, 139.9000], [35.6600, 139.9300], [35.6820, 139.9700], [35.6850, 140.0150], [35.6600, 140.0450], [35.6300, 140.0700], [35.6100, 140.1000]], deck: 18 },
  { id: "aqua", name: "Tokyo Bay Aqua-Line", cls: "hwy", scenic: true, pts: [[35.5030, 139.7660], [35.4900, 139.8100], [35.4750, 139.8500], [35.4635, 139.8730], [35.4400, 139.8950], [35.4150, 139.9150], [35.3811, 139.9250]], deck: 24 },
  { id: "gaikan", name: "Tokyo Gaikan Expressway", cls: "hwy", pts: [[35.6290, 139.6320], [35.6600, 139.6150], [35.7025, 139.6145], [35.7380, 139.6095], [35.7512, 139.6050], [35.7855, 139.7090], [35.8000, 139.7600], [35.8155, 139.8350], [35.8000, 139.9000], [35.7600, 139.9400], [35.7219, 139.9511], [35.6820, 139.9700]], deck: 14 },
  { id: "keno", name: "Ken-O Ring Expressway", cls: "hwy", ground: true, pts: [[35.4300, 139.3500], [35.5000, 139.3300], [35.5714, 139.3500], [35.6600, 139.3200], [35.7800, 139.3000], [35.8200, 139.4500], [35.9300, 139.5200], [35.9900, 139.6200]], deck: 12 },
  { id: "rainbow", name: "Rainbow Bridge", cls: "hwy", scenic: true, pts: [[35.6475, 139.7585], [35.6410, 139.7625], [35.6360, 139.7690], [35.6290, 139.7780], [35.6200, 139.7800]], deck: 30 },
  { id: "gate", name: "Tokyo Gate Bridge", cls: "hwy", scenic: true, pts: [[35.6330, 139.8360], [35.6150, 139.8350], [35.5980, 139.8200], [35.5880, 139.7960]], deck: 26 },
  { id: "baybridge", name: "Yokohama Bay Bridge", cls: "hwy", scenic: true, pts: [[35.4620, 139.6930], [35.4510, 139.6850], [35.4400, 139.6760], [35.4300, 139.6750]], deck: 28 },
  { id: "tsubasa", name: "Tsurumi Tsubasa Bridge", cls: "hwy", scenic: true, pts: [[35.4660, 139.6900], [35.4800, 139.6860], [35.4950, 139.6800], [35.5080, 139.6760]], deck: 22 },
  { id: "k1", name: "Yokohane Line", cls: "hwy", pts: [[35.4750, 139.6350], [35.4985, 139.6700], [35.5150, 139.7050], [35.5250, 139.7350], [35.5400, 139.7650], [35.5500, 139.7850]], deck: 16 },
  { id: "k5", name: "Daikoku Line", cls: "hwy", ground: true, pts: [[35.4620, 139.6930], [35.4750, 139.6760], [35.4880, 139.6620], [35.4950, 139.6300], [35.5100, 139.6000]], deck: 14 },
  // ---- the old national routes and avenues ----
  { id: "kk15", name: "Daiichi Keihin (Route 15)", cls: "hwy", ground: true, pts: [[35.6285, 139.7387], [35.6000, 139.7450], [35.5650, 139.7280], [35.5309, 139.6970], [35.5000, 139.6750], [35.4700, 139.6550], [35.4437, 139.6510]], deck: 12 },
  { id: "kk1", name: "Route 1 Tokaido", cls: "art", ground: true, pts: [[35.6600, 139.7580], [35.6285, 139.7420], [35.6040, 139.7190], [35.5700, 139.6790], [35.5300, 139.6400], [35.4900, 139.6150], [35.4500, 139.5950], [35.4100, 139.5600], [35.3800, 139.5200], [35.3500, 139.4900]] },
  { id: "kk20", name: "Koshu Kaido (Route 20)", cls: "art", ground: true, pts: [[35.6860, 139.7390], [35.6895, 139.7000], [35.6960, 139.6600], [35.6920, 139.6000], [35.6800, 139.5500], [35.6700, 139.5000], [35.6600, 139.4300], [35.6500, 139.3600], [35.6450, 139.3000]] },
  { id: "kk246", name: "Route 246 Aoyama Dori", cls: "art", ground: true, pts: [[35.6740, 139.7440], [35.6650, 139.7180], [35.6580, 139.7010], [35.6440, 139.6700], [35.6300, 139.6300], [35.6050, 139.5700], [35.5800, 139.5100], [35.5500, 139.4600], [35.5000, 139.4200], [35.4500, 139.3600]] },
  { id: "kk17", name: "Route 17 Nakasendo", cls: "art", ground: true, pts: [[35.6905, 139.7580], [35.7295, 139.7090], [35.7700, 139.6900], [35.8200, 139.6500], [35.8800, 139.6350], [35.9300, 139.6200]] },
  { id: "kk4", name: "Nikko Kaido (Route 4)", cls: "art", ground: true, pts: [[35.6830, 139.7745], [35.7250, 139.7900], [35.7700, 139.8000], [35.8200, 139.8250], [35.8700, 139.8000], [35.9300, 139.8100]] },
  { id: "kk14", name: "Chiba Kaido (Route 14)", cls: "art", ground: true, pts: [[35.6830, 139.7745], [35.6800, 139.8300], [35.6900, 139.9000], [35.6980, 139.9500], [35.6900, 140.0000], [35.6500, 140.0400], [35.6100, 140.1000]] },
  { id: "kk16", name: "Route 16 Ring Road", cls: "hwy", ground: true, pts: [[35.4437, 139.6260], [35.5100, 139.5600], [35.5700, 139.5200], [35.6200, 139.4400], [35.6700, 139.3700], [35.7500, 139.4000], [35.8000, 139.4800], [35.8800, 139.5800], [35.9100, 139.6500], [35.8800, 139.7700], [35.8700, 139.8500], [35.8500, 139.9400], [35.8000, 140.0200], [35.7000, 140.0700], [35.6400, 140.1400]], deck: 11 },
  { id: "r8", name: "Kanjo Hachi (Ring Road 8)", cls: "art", ground: true, pts: [[35.7500, 139.6700], [35.7300, 139.6450], [35.7000, 139.6350], [35.6700, 139.6400], [35.6450, 139.6450], [35.6200, 139.6300]] },
  { id: "r7ring", name: "Kanjo Nana (Ring Road 7)", cls: "art", ground: true, pts: [[35.6300, 139.7500], [35.6400, 139.7250], [35.6470, 139.7000], [35.6600, 139.6800], [35.6850, 139.6650], [35.7200, 139.6700], [35.7500, 139.6950], [35.7500, 139.7400], [35.7300, 139.7800], [35.7000, 139.8100], [35.6850, 139.8200]] },
  { id: "yokosuka", name: "Yokohama–Yokosuka Road", cls: "hwy", ground: true, pts: [[35.4437, 139.6260], [35.4000, 139.6100], [35.3600, 139.6150], [35.3200, 139.6500], [35.2830, 139.6720]], deck: 11 },
  { id: "shonan", name: "Shonan Bypass", cls: "hwy", ground: true, pts: [[35.3500, 139.3000], [35.3550, 139.3600], [35.3600, 139.4300], [35.3650, 139.4900], [35.3600, 139.5300], [35.3450, 139.5700]], deck: 11 },
  { id: "r134", name: "Route 134 Shonan Coast Road", cls: "art", ground: true, scenic: true, pts: [[35.3270, 139.3500], [35.3310, 139.4000], [35.3250, 139.4550], [35.3170, 139.4850], [35.3130, 139.5450], [35.3000, 139.5750], [35.2900, 139.6100]] },
  { id: "tamagawa", name: "Tamagawa Levee Road", cls: "art", ground: true, scenic: true, pts: [[35.6580, 139.4300], [35.6540, 139.4800], [35.6400, 139.5350], [35.6120, 139.6200], [35.5900, 139.6700], [35.5660, 139.7200], [35.5450, 139.7600]] },
  { id: "arakawa", name: "Arakawa Levee Road", cls: "art", ground: true, scenic: true, pts: [[35.8200, 139.6900], [35.7900, 139.7150], [35.7600, 139.7500], [35.7400, 139.7950], [35.7200, 139.8300], [35.6970, 139.8500]] },
  { id: "bosoroad", name: "Boso Coast Road", cls: "hwy", ground: true, pts: [[35.3811, 139.9250], [35.3500, 139.9500], [35.3200, 139.9800], [35.2900, 140.0200], [35.2600, 140.0500]], deck: 10 },
  { id: "kujukuri", name: "Kujukuri Highway", cls: "hwy", ground: true, pts: [[35.6100, 140.1000], [35.5500, 140.1700], [35.4800, 140.2000], [35.4000, 140.2300], [35.3200, 140.2500]], deck: 10 },
  // ---- the airport, Haneda ----
  { id: "hnd1", name: "Airport Road", cls: "art", ground: true, pts: [[35.5800, 139.7600], [35.5700, 139.7650], [35.5600, 139.7710], [35.5520, 139.7770]] },
  { id: "hnd2", name: "Airport Approach", cls: "art", ground: true, pts: [[35.5520, 139.7770], [35.5400, 139.7650], [35.5300, 139.7520], [35.5220, 139.7440]] },
  { id: "hnd3", name: "Airport Loop", cls: "art", ground: true, pts: [[35.5800, 139.7600], [35.5650, 139.7500], [35.5450, 139.7440], [35.5220, 139.7440]] },
  // ---- the mountain passes (touge) ----
  { id: "yabitsu", name: "Yabitsu Pass", cls: "art", ground: true, hill: true, pts: [[35.3900, 139.2550], [35.4050, 139.2400], [35.4200, 139.2500], [35.4350, 139.2300], [35.4500, 139.2450], [35.4650, 139.2250], [35.4800, 139.2400], [35.4950, 139.2200], [35.5150, 139.2350], [35.5350, 139.2200]] },
  { id: "takao", name: "Takao Skyline", cls: "art", ground: true, hill: true, pts: [[35.6400, 139.2850], [35.6320, 139.2700], [35.6420, 139.2550], [35.6300, 139.2420], [35.6400, 139.2280], [35.6260, 139.2150], [35.6360, 139.2000], [35.6220, 139.1900], [35.6320, 139.1700]] },
  { id: "okutama", name: "Okutama Lake Road", cls: "art", ground: true, hill: true, pts: [[35.7700, 139.3200], [35.7750, 139.2900], [35.7900, 139.2700], [35.7850, 139.2400], [35.8000, 139.2150], [35.7950, 139.1900], [35.8100, 139.1700], [35.8050, 139.1400]] },
  { id: "omekaido", name: "Ome Kaido", cls: "art", ground: true, pts: [[35.6985, 139.4140], [35.7300, 139.3800], [35.7500, 139.3500], [35.7700, 139.3200]] },
  { id: "miura", name: "Miura Skyline", cls: "art", ground: true, hill: true, pts: [[35.3000, 139.6500], [35.2900, 139.6400], [35.2750, 139.6250], [35.2600, 139.6450], [35.2450, 139.6250], [35.2300, 139.6300]] },
  { id: "bososky", name: "Boso Skyline", cls: "art", ground: true, hill: true, pts: [[35.3520, 139.9300], [35.3300, 139.9600], [35.3450, 139.9850], [35.3200, 140.0100], [35.3000, 140.0400], [35.2850, 140.0200], [35.2650, 140.0450], [35.2500, 140.0700]] },
  { id: "tamahills", name: "Tama Hills Road", cls: "art", ground: true, hill: true, pts: [[35.6240, 139.4700], [35.6000, 139.4450], [35.6150, 139.4200], [35.5900, 139.4000], [35.5700, 139.4200], [35.5500, 139.3900], [35.5700, 139.3600]] },
  { id: "sayama", name: "Sayama Hills Road", cls: "art", ground: true, hill: true, pts: [[35.7900, 139.4900], [35.7800, 139.4600], [35.7950, 139.4300], [35.7800, 139.4000], [35.7950, 139.3700]] },
  // Upgrade 34: the three iconic drift roads. Hakone Turnpike is in its real place (Kanagawa); Mount Akina and Mount Fuji lie far beyond the map's edge, so their roads stand on the western mountains.
  { id: "hakone", name: "Hakone Turnpike", cls: "art", ground: true, hill: true, scenic: true, width: 16, fillet: 22, mapPts: zigM(1760, 17250, 520, 16330, 17, 230) },
  { id: "akina", name: "Mount Akina Pass", cls: "art", ground: true, hill: true, width: 16, fillet: 22, pts: zig(35.9300, 139.2050, 35.9900, 139.1250, 17, 0.0130) },
  { id: "fuji", name: "Mount Fuji Skyline", cls: "art", ground: true, hill: true, scenic: true, width: 16, fillet: 22, pts: zig(35.4300, 139.1100, 35.4700, 139.0300, 17, 0.0125) },
  { id: "daikoku", name: "Daikoku Pier Road", cls: "art", ground: true, pts: [[35.4660, 139.6790], [35.4580, 139.6860], [35.4520, 139.6990], [35.4560, 139.7020], [35.4640, 139.6980]] },
];

// the east-side arterials (the same role the 2046 additions played in Mumbai)
export const TOKYO_2046 = [];

// grid zones: [name, polygon in map metres, angle, arterial spacing, street spacing, wobble, max height]
export function tokyoZones() {
  const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return [
    { poly: R(0, 0, W, 5200), ang: 0.05, art: 520, str: 200, wob: 10, name: "Saitama", hmax: 60 },
    { poly: R(0, 5200, 6800, 14800), ang: -0.38, art: 520, str: 205, wob: 18, name: "Tama", hmax: 74 },
    { poly: R(6800, 5200, 15200, 12000), ang: 0.12, art: 420, str: 140, wob: 14, name: "Tokyo", hmax: 60 },
    { poly: R(15200, 5200, W, 22000), ang: 0.35, art: 520, str: 200, wob: 8, name: "Chiba", hmax: 70 },
    { poly: [[0, 14800], [6800, 14800], [6800, 12000], [15200, 12000], [15200, 22000], [0, 22000]], ang: -0.5, art: 500, str: 195, wob: 12, name: "Kanagawa", hmax: 70 },
  ];
}

// bridges across the four rivers, one about every kilometre, so the grids on either bank are joined
export function tokyoBridges() {
  const out = [];
  let n = 0;
  for (const r of RIVERS) {
    const xy = LLs(r.pts);
    let acc = 0, next = 300;
    for (let i = 0; i + 1 < xy.length; i++) {
      const a = xy[i], b = xy[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (next - acc < L) {
        const t = (next - acc) / L, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
        const ext = r.hw * 1.15 + 190, nx = -dz, nz = dx;
        const p0 = [x - nx * ext, z - nz * ext], p1 = [x + nx * ext, z + nz * ext];
        const ok = (p) => p[0] > 150 && p[1] > 150 && p[0] < W - 150 && p[1] < W - 150 && !isWater(p[0], p[1]) && shoreDist(p[0], p[1]) > 40 && !inAirport(p[0], p[1], 80);
        if (ok(p0) && ok(p1)) {
          const m = [x, z], cls = r.hw > 70 ? "hwy" : "art";
          out.push({ id: `rbr_${r.id}_${n++}`, name: `${r.name} Bridge`, cls: cls === "hwy" ? "art" : cls, raw: [p0, [(p0[0] + x) / 2, (p0[1] + z) / 2], m, [(p1[0] + x) / 2, (p1[1] + z) / 2], p1], ground: false, deck: 10 });
        }
        next += 1050;
      }
      acc += L;
    }
  }
  return out;
}
export { ll };
