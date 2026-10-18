// Midnight Burn — everything there is to do in the city: races, duels, drifts, speed traps, deliveries,
// sights to find, cash stashes and the four shops. Built from the city itself so each event sits on real road.
import { DISTRICTS, mulberry } from "./geo";
import { DRIVERS } from "../drivers";

const K = 1000;
const MEDAL = ["gold", "silver", "bronze"];
export const MEDAL_PTS = { gold: 1, silver: 0.65, bronze: 0.4 };

// where the ladder drivers hang out (overrides the old fictional home names)
export const HOME = {
  pixel: "Colaba Causeway", rook: "Sewri Docks", nova: "Bandra Reclamation", mako: "Airoli Docks", juno: "Yeoor Hills",
  dagger: "Thane Station Road", saint: "Marine Drive", vex: "Palm Beach Road", nyx: "Atal Setu", kage: "Bandra–Worli Sea Link",
};

export function buildContent(world) {
  const city = world.city;
  const lm = {}; world.landmarks.forEach((l) => (lm[l.id] = { x: l.rx ?? l.x, z: l.rz ?? l.z, name: l.name, kind: l.kind, id: l.id }));
  const dist = {}; DISTRICTS.forEach((d) => (dist[d.id] = d));
  const snap = (x, z, rad = 700) => { const n = city.nearestNode(x, z, rad); return n ? { x: n.x, z: n.z, y: n.y ?? 0 } : null; };
  const P = (id) => { const a = lm[id] || dist[id]; return [a.rx ?? a.x, a.rz ?? a.z]; };

  const events = [];
  const add = (e) => { events.push(e); return e; };

  // ---- ordinary races ------------------------------------------------------------------------------------------------
  const circuits = [
    ["circ-marine", "Marine Drive Loop", "South Mumbai", ["colaba", "marinedrive", "nariman", "fort"], 2, 1, "A tight loop round the Queen's Necklace and back through the old Fort streets."],
    ["circ-worli", "Worli Sea Face Circuit", "Worli", ["malabar", "hajiali", "dharavi", "cst", "nariman"], 2, 2, "Down the sea face, across the island, and back up the hill."],
    ["circ-bkc", "BKC Glass Circuit", "Bandra Kurla", ["bkc", "kurla", "sewri", "dadar", "bandra"], 2, 3, "Fast boulevards between the glass towers and a slide through Dharavi's back lanes."],
    ["circ-powai", "Powai Lake Loop", "Powai", ["powai", "ghatkopar", "kurla", "bkc"], 2, 4, "Round the lake, down the highway, and back through the towers."],
    ["circ-thane", "Thane Lake Circuit", "Thane", ["thane", "ghatkopar", "powai", "upvan"], 2, 5, "Thane's flyovers, the lake road and a fast sweep back from Powai."],
    ["circ-navi", "Navi Mumbai Grid", "Navi Mumbai", ["vashiarch", "palmbeach", "belapur", "kharghar"], 2, 6, "Big planned boulevards, long straights, roundabouts that never end."],
    ["circ-port", "JNPT Docklands Circuit", "Uran / JNPT", ["nerul", "jnpt", "kharghar", "belapur"], 1, 7, "Out to the port and back along the highway — an endurance run."],
    ["circ-ghat", "Kharghar Hills Circuit", "Kharghar", ["kalamboli", "kharghar", "belapur", "nerul"], 2, 8, "Fast flowing roads through the planned townships and hills of the south."],
    ["circ-vasai", "Vasai Bay Circuit", "Vasai–Virar", ["vasai", "virar", "mira"], 2, 3, "Fast coastal suburbs north of the city, open roads and quick sweepers."],
    ["circ-kalyan", "Kalyan Fort Circuit", "Kalyan", ["kalyan", "dombivli", "ambernath", "bhiwandi"], 2, 5, "Round the old fort towns and the warehouse belt."],
    ["circ-pune", "Pune Ring Circuit", "Pune", ["hinjewadi", "kothrud", "pune", "hadapsar", "pimpri"], 2, 8, "The big ring road around Pune — long, fast and unforgiving."],
  ];
  for (const [id, name, area, w, laps, lvl, blurb] of circuits) {
    const wp = w.map(P);
    add({ id, type: "circuit", name, area, blurb, level: lvl, wp, loop: true, laps, racers: 3, ai: { base: 0.8 + lvl * 0.012, latG: 0.78 }, reward: { cash: 500 + lvl * 160, xp: 220 + lvl * 50, pts: 700 + lvl * 160 } });
  }
  const sprints = [
    ["spr-gateway", "Gateway to Worli", "South Mumbai", "gateway", "hajiali", 1, "A run up the coast to warm up."],
    ["spr-sealink", "Sea Link Sprint", "Bandra-Worli", "juhu", "worli", 2, "Cross the cable-stayed bridge flat out."],
    ["spr-dharavi", "Dharavi Dash", "Dadar", "cst", "dharavi", 2, "Through the narrowest streets in the city."],
    ["spr-eeh", "Eastern Express Sprint", "Eastern Express Highway", "dharavi", "upvan", 3, "Mumbai to Thane, five lanes, no mercy."],
    ["spr-vashi", "Vashi Bridge Run", "Vashi", "dharavi", "vashiarch", 4, "Over the creek bridge and into Navi Mumbai."],
    ["spr-atal", "Atal Setu Run", "Mumbai Harbour", "gateway", "jnpt", 5, "The long sea bridge. Top speed time."],
    ["spr-kalyan", "Kalyan Hill Sprint", "Thane", "thane", "yeoor", 4, "Steep, twisty, wet. Bring your best tyres."],
    ["spr-belapur", "Palm Beach Express", "Navi Mumbai", "vashiarch", "belapur", 3, "The famous coast road at full tilt."],
    ["spr-ghat", "Ghat Summit Sprint", "The Ghats", "belapur", "ghat", 6, "A mountain pass from the sea up to the clouds."],
    ["spr-csmia", "Airport Rush Hour", "Andheri", "csmia", "bkc", 2, "Out of the terminal and across the city before the next flight lands."],
    ["spr-nmia", "NMIA Night Flight", "Ulwe", "nmia", "vashiarch", 4, "From the new airport up the Palm Beach corridor, flat out."],
    ["spr-thanecoast", "Thane Coastal Sprint", "Thane", "thane", "thanecoastal", 3, "The new coastal road along the creek, wide and fast."],
    ["spr-vasai", "Vasai Creek Run", "Vasai", "vasai", "mira", 3, "North along the creek towns, tight turns and long straights."],
    ["spr-kalyan2", "Kalyan–Dombivli Dash", "Kalyan", "kalyan", "dombivli", 4, "Two busy railway towns, one narrow set of lanes."],
    ["spr-uran", "Uran Port Road", "Uran", "panvel", "uran", 5, "Container trucks, cranes and a long road to the sea."],
    ["spr-lonavala", "Expressway Express", "Khalapur", "panvel", "lonavala", 6, "Up the Mumbai–Pune Expressway, through the ghat tunnels to the hill station."],
    ["spr-pune", "Mumbai–Pune Marathon", "Expressway", "panvel", "pune", 8, "The whole expressway, sea level to the Deccan plateau. An endurance run."],
    ["spr-pune2", "Pune IT Park Dash", "Pune", "hinjewadi", "hadapsar", 7, "Across Pune's ring roads from the tech parks to the east side."],
    ["spr-airoli", "Airoli Bridge Blast", "Airoli", "thane", "kharghar", 5, "Across the creek and down the whole of Navi Mumbai."],
  ];
  for (const [id, name, area, a, b, lvl, blurb] of sprints) {
    add({ id, type: "sprint", name, area, blurb, level: lvl, wp: [P(a), P(b)], loop: false, laps: 1, racers: 3, ai: { base: 0.8 + lvl * 0.013, latG: 0.78 }, reward: { cash: 420 + lvl * 150, xp: 200 + lvl * 45, pts: 600 + lvl * 140 } });
  }
  const knock = [
    ["ko-colaba", "Colaba Knockout", "South Mumbai", ["colaba", "fort", "marinedrive", "nariman", "malabar"], 2],
    ["ko-bkc", "BKC Knockout", "Bandra Kurla", ["bandra", "bkc", "kurla", "dharavi", "worli"], 4],
    ["ko-thane", "Thane Knockout", "Thane", ["thane", "upvan", "airoli", "ghatkopar", "powai"], 6],
    ["ko-navi", "Navi Knockout", "Navi Mumbai", ["vashiarch", "nerul", "belapur", "kharghar", "kalamboli"], 7],
  ];
  for (const [id, name, area, w, lvl] of knock) add({ id, type: "knockout", name, area, blurb: "Last car at each checkpoint is out. Stay ahead of the pack.", level: lvl, wp: w.map(P), loop: false, laps: 1, racers: 4, ai: { base: 0.8 + lvl * 0.014, latG: 0.8 }, reward: { cash: 650 + lvl * 160, xp: 280 + lvl * 50, pts: 900 + lvl * 170 } });

  // drag races along the straightest long stretches of the big roads
  // Upgrade 23: the iconic one - Palm Beach Road after midnight, the street where Navi Mumbai's racers settle things. Open from level 1 and offered
  // as a way to begin a new career. (The old "Palm Beach Drag" was really on the Vashi Bridge, so it is now called that.)
  const dragRoads = [["palm", 0.5, "Palm Beach Road: The Midnight Drag", "Navi Mumbai", 1, true], ["eeh", 0.45, "Eastern Express Drag", "Ghatkopar", 3], ["weh", 0.12, "Western Express Drag", "Andheri", 2], ["vashi", 0.4, "Vashi Bridge Drag", "Navi Mumbai", 5], ["atal", 0.5, "Atal Setu Drag", "Mumbai Harbour", 7]];
  for (const [rid, f, name, area, lvl, iconic] of dragRoads) {
    const r = city.roads.find((q) => q.id === rid); if (!r) continue;
    // find the straightest 700 m window near fraction f
    let best = null, bs = 1e9;
    for (let i = Math.floor(r.pts.length * Math.max(0, f - 0.35)); i < r.pts.length * Math.min(1, f + 0.35); i += 4) {
      const p = r.pts[i]; let j = i; while (j < r.pts.length - 1 && r.pts[j].s - p.s < 700) j++; if (r.pts[j].s - p.s < 650) continue;
      const q = r.pts[j]; const chord = Math.hypot(q.x - p.x, q.z - p.z); const bend = (q.s - p.s) / chord - 1; const climb = Math.abs(q.y - p.y);
      const score = bend * 400 + climb * 0.5; if (score < bs) { bs = score; best = { i, j }; }
    }
    if (!best) continue;
    const pts = r.pts.slice(best.i, best.j + 1); const a = pts[0], b = pts[pts.length - 1];
    add({ id: iconic ? "drag-palm" : "drag-" + rid, type: "drag", name, area, blurb: iconic ? "The most famous strip in Navi Mumbai: Palm Beach Road after midnight, palms and mangroves flashing past. 700 metres, one rival, your nitrous against theirs." : "700 metres. One rival. Time your nitrous.", level: lvl, wp: [[a.x, a.z], [b.x, b.z]], fixedRoute: pts.map((p) => ({ x: p.x, z: p.z, y: p.y })), loop: false, laps: 1, racers: 1, ai: { base: iconic ? 0.9 : 0.92 + lvl * 0.008, latG: 1 }, reward: iconic ? { cash: 900, xp: 260, pts: 900 } : { cash: 380 + lvl * 120, xp: 160 + lvl * 35, pts: 500 + lvl * 120 }, grid: true, iconic: !!iconic });
  }

  // ---- the ladder: ten named drivers, one duel each --------------------------------------------------------------------
  const duelRoutes = {
    pixel: ["colaba", "marinedrive"], rook: ["sewri", "dadar"], nova: ["bandra", "dharavi"], mako: ["airoli", "nerul"], juno: ["thane", "yeoor"],
    dagger: ["thane", "ghatkopar"], saint: ["gateway", "marinedrive", "worli"], vex: ["vashiarch", "palmbeach", "belapur"], nyx: ["gateway", "atal", "jnpt"], kage: ["juhu", "sealink", "worli", "bkc"],
  };
  for (const d of DRIVERS) {
    const w = duelRoutes[d.id].map((i) => (i === "dharavi" || i === "cst" ? P(i) : P(i)));
    add({ id: "duel-" + d.id, type: "duel", driver: d.id, name: `${d.name} — ${d.title}`, area: HOME[d.id], blurb: d.style, level: d.reqLevel, wp: w, loop: false, laps: 1, racers: 1, ai: { ...d.ai }, carLevel: d.carLevel, reward: { ...d.reward }, boss: d.rank === 1, requires: d.rank === 10 ? null : "duel-" + DRIVERS.find((x) => x.rank === d.rank + 1).id });
  }

  // ---- drift zones -------------------------------------------------------------------------------------------------------
  const drifts = [["drift-colaba", "Colaba Slide", "colaba", 250, 1, [8000, 16000, 26000]], ["drift-bkc", "BKC Roundabout Drift", "bkc", 300, 3, [12000, 24000, 38000]], ["drift-navi", "Vashi Sector Slide", "vashi", 320, 4, [14000, 28000, 44000]], ["drift-yeoor", "Yeoor Hairpins", "yeoor", 320, 5, [16000, 32000, 50000]], ["drift-ghat", "Ghat Hairpins", "ghat", 380, 7, [20000, 40000, 62000]], ["drift-port", "Container Yard Drift", "jnpt", 340, 6, [18000, 36000, 56000]]];
  for (const [id, name, where, rad, lvl, goals] of drifts) {
    const [x, z] = P(where); const s = snap(x, z, 700); if (!s) continue;
    add({ id, type: "drift", name, area: (dist[where] || lm[where]).name, blurb: "Drift for points inside the ring before the clock runs out. Chain slides for a multiplier.", level: lvl, x: s.x, z: s.z, radius: rad, time: 100, goals, reward: { cash: 300 + lvl * 110, xp: 150 + lvl * 35, pts: 500 + lvl * 100 } });
  }

  // ---- speed traps ----------------------------------------------------------------------------------------------------------
  const trapRoads = [["weh", 0.3, "Sea Link Speed Trap", 1, [150, 180, 215]], ["eeh", 0.55, "Eastern Express Trap", 2, [165, 195, 230]], ["atal", 0.5, "Atal Setu Trap", 4, [180, 215, 250]], ["vashi", 0.35, "Palm Beach Trap", 3, [165, 195, 230]], ["thanebel", 0.5, "Thane–Belapur Trap", 3, [160, 190, 225]], ["pune", 0.3, "Expressway Trap", 5, [185, 220, 255]], ["marine", 0.5, "Marine Drive Trap", 1, [140, 170, 200]], ["hbr", 0.5, "Harbour Road Trap", 2, [150, 180, 215]]];
  for (const [rid, f, name, lvl, goals] of trapRoads) {
    const r = city.roads.find((q) => q.id === rid); if (!r) continue; const p = r.pts[Math.floor(r.pts.length * f)]; const q = r.pts[Math.min(r.pts.length - 1, Math.floor(r.pts.length * f) + 2)];
    add({ id: "trap-" + rid, type: "trap", name, area: r.name, blurb: "Hit the speed camera as fast as you can. No time limit — keep trying.", level: lvl, x: p.x, z: p.z, y: p.y, yaw: Math.atan2(q.z - p.z, q.x - p.x), goals, reward: { cash: 250 + lvl * 100, xp: 120 + lvl * 25, pts: 400 + lvl * 100 } });
  }

  // ---- deliveries (side quests) --------------------------------------------------------------------------------------------
  const jobs = [
    ["del-chai", "Chai Run", "Colaba", "colaba", "marinedrive", "Hot chai for the Marine Drive night crowd. Don't spill it — keep it smooth.", 1, 150],
    ["del-parts", "Parts Run", "Dharavi", "dharavi", "powai", "A crate of turbo parts for a BKC tuner before dawn.", 2, 210],
    ["del-taxi", "Airport Rush", "Juhu", "juhu", "bkc", "A late flight and a nervous passenger. Drive fast but safe.", 3, 240],
    ["del-film", "Film Reel", "Fort", "cst", "juhu", "A film print that must reach the Juhu studio before midnight.", 4, 330],
    ["del-sample", "Lab Sample", "Powai", "powai", "thane", "Medical samples across the city, no time to lose.", 5, 360],
    ["del-cargo", "Dock Courier", "Vashi", "vashiarch", "jnpt", "Customs papers to the port, before the ship leaves.", 6, 420],
  ];
  for (const [id, name, area, a, b, blurb, lvl, base] of jobs) add({ id, type: "delivery", name, area, blurb, level: lvl, wp: [P(a), P(b)], loop: false, reward: { cash: base * 2, xp: base, pts: base * 3 }, timeMul: 1.18 });

  // ---- sights to find ---------------------------------------------------------------------------------------------------------
  const sights = world.landmarks.map((l) => ({ id: "sight-" + l.id, name: l.name, x: l.rx ?? l.x, z: l.rz ?? l.z, y: l.ry ?? 0, kind: l.kind }));

  // ---- cash stashes: scattered along roads, many off the main drag --------------------------------------------------------
  const rnd = mulberry(4242); const stashes = [];
  const roadsAll = city.roads.filter((r) => r.pts.length > 12);
  const totalLen = roadsAll.reduce((a, r) => a + r.len, 0);
  for (let tries = 0; stashes.length < 300 && tries < 30000; tries++) {
    let t = rnd() * totalLen, r = roadsAll[0]; for (const q of roadsAll) { if (t < q.len) { r = q; break; } t -= q.len; }
    const k = Math.floor(rnd() * (r.pts.length - 2)); const p = r.pts[k];
    if (p.w > 0.35 && p.y - p.g > 3 && rnd() < 0.5) continue;
    if (stashes.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 300)) continue;
    stashes.push({ id: "st" + stashes.length, x: p.x, z: p.z, y: p.y, big: r.scenic || r.hill ? rnd() < 0.6 : rnd() < 0.15 });
  }

  // ---- shops -----------------------------------------------------------------------------------------------------------------------
  const shopDefs = [
    { id: "perf", kind: "perf", name: "Dharavi Performance Works", at: "dadar", icon: "🔧", blurb: "Engine, tyres, suspension and nitrous." },
    { id: "visual", kind: "visual", name: "Bandra Body Shop", at: "bandra", icon: "🎨", blurb: "Paint, vinyls, body kits, wings, rims and neon." },
    { id: "lot", kind: "lot", name: "BKC Car Lot", at: "bkc", icon: "🚗", blurb: "Buy and swap cars." },
    { id: "audio", kind: "audio", name: "Juhu Sound Garage", at: "juhu", icon: "🔊", blurb: "Subwoofers, amps and trunk audio systems." },
    { id: "perf2", kind: "perf", name: "Vashi Tuning Bay", at: "vashi", icon: "🔧", blurb: "Engine, tyres, suspension and nitrous." },
    { id: "home", kind: "home", name: "Your Garage — Marine Drive", at: "marinedrive", icon: "🏠", blurb: "Home. Save, change cars, review your career." },
    { id: "visual2", kind: "visual", name: "Thane Style Studio", at: "thane", icon: "🎨", blurb: "Paint, vinyls, body kits, wings, rims and neon." },
  ];
  const shops = shopDefs.map((s) => { const [x, z] = P(s.at); const n = snap(x, z, 700); const pt = city.nearestRoad(n ? n.x : x, n ? n.z : z, 200, (r) => r.ground !== false && r.cls !== "hwy", null); return { ...s, x: pt ? pt.x : n.x, z: pt ? pt.z : n.z, y: pt ? pt.y : 0 }; });

  return { events, sights, stashes, shops, landmarks: lm, byId: Object.fromEntries(events.map((e) => [e.id, e])) };
}

// ---- routes for the races ------------------------------------------------------------------------------------------------------------------------
export function buildRoute(world, ev) {
  const city = world.city;
  if (ev.fixedRoute) return finishRoute(ev.fixedRoute.map((p) => ({ ...p })), ev);
  const wps = ev.loop ? [...ev.wp, ev.wp[0]] : ev.wp;
  let all = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = city.nearestNode(wps[i][0], wps[i][1], 800), b = city.nearestNode(wps[i + 1][0], wps[i + 1][1], 800); if (!a || !b) return null;
    const path = a === b ? [] : city.route(a, b); if (!path) return null;
    // a waypoint on a spur would make the route reverse on itself: cancel out the retraced bit
    for (const st of path) { const last = all[all.length - 1]; if (last && last.edge === st.edge && last.dir === -st.dir) all.pop(); else all.push(st); }
  }
  if (ev.loop) while (all.length >= 2 && all[0].edge === all[all.length - 1].edge && all[0].dir === -all[all.length - 1].dir) { all.shift(); all.pop(); }
  const pts = [];
  for (const p of city.routePoints(all)) pts.push({ x: p.x, z: p.z, y: p.y });
  if (pts.length < 8) return null;
  return finishRoute(pts, ev);
}
function finishRoute(pts, ev) {
  let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  // checkpoints roughly every 320 m (always include the last point); knockout events use their waypoints
  const gates = []; let next = 320;
  for (let i = 1; i < pts.length; i++) if (pts[i].s >= next || i === pts.length - 1) { gates.push(i); next = pts[i].s + 320; }
  if (gates.length > 1 && pts[pts.length - 1].s - pts[gates[gates.length - 2]].s < 120) gates.splice(gates.length - 2, 1);
  const out = { pts, len: s, gates };
  if (ev.type === "knockout") { const n = ev.wp.length - 1; out.cuts = []; for (let k = 1; k <= Math.min(3, n); k++) out.cuts.push(Math.floor(gates.length * (k / (Math.min(3, n) + 1)))); }
  return out;
}
export { MEDAL };
