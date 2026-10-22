// Midnight Burn: Tokyo Drift — the things to do. Same shapes as the Mumbai tables in content.js; ids refer to landmarks (tokyoLandmarks.js) and districts (tokyoGeo.js).
export const T_HOME = {
  pixel: "Ginza Backstreets", rook: "Keihin Docks", nova: "Odaiba Waterfront", mako: "Tsurumi Docks", juno: "Takao Mountains",
  dagger: "Shinjuku Golden Gai", saint: "Tokyo Tower", vex: "Shibuya Crossing", nyx: "Rainbow Bridge", kage: "Daikoku Pier",
};
export const T_CIRCUITS = [
  ["circ-c1", "C1 Inner Loop", "Central Tokyo", ["tokyostation", "ginza", "shiodome", "nihonbashi"], 2, 1, "The tight Shuto loop round the Imperial Palace: concrete walls, sharp bends, tunnels of light."],
  ["circ-shibuya", "Shibuya Scramble Circuit", "Shibuya", ["shibuyax", "harajuku", "roppongi", "meguro"], 2, 2, "Neon boulevards between the fashion streets and the glass towers of Roppongi."],
  ["circ-shinjuku", "Shinjuku Neon Circuit", "Shinjuku", ["shinjuku", "nakano", "ikebukuro", "harajuku"], 2, 3, "Skyscraper canyons, the rain-slick west side and a fast run up to Ikebukuro."],
  ["circ-skytree", "Sumida Skytree Circuit", "Asakusa", ["skytree", "asakusa", "ueno", "nihonbashi"], 2, 2, "Old Tokyo under the new tower: temple lanes, river bridges and electric town."],
  ["circ-odaiba", "Odaiba Waterfront Circuit", "Odaiba", ["odaiba", "toyosu", "bigsight", "shiodome"], 2, 3, "The reclaimed islands: wide roads, bridges, a Ferris wheel and the bay."],
  ["circ-haneda", "Haneda Flight Path Circuit", "Ota", ["hnd", "hanedatown", "ota", "shinagawa"], 2, 4, "Round the airport as the jets come in over your head."],
  ["circ-yokohama", "Minato Mirai Circuit", "Yokohama", ["landmarktower", "kannai", "daikoku", "kohoku"], 2, 5, "Yokohama's harbour towers, Chinatown lanes and the long bayside straights."],
  ["circ-kawasaki", "Keihin Industrial Circuit", "Kawasaki", ["kawasaki", "keihin", "tsurumi", "ota"], 2, 4, "Refineries, flare stacks and pipelines glowing along a fast industrial belt."],
  ["circ-chiba", "Chiba Bayside Circuit", "Chiba", ["makuhari", "chiba", "funabashi", "urayasu"], 2, 6, "Long sweeping roads along the eastern shore of the bay."],
  ["circ-saitama", "Saitama Super Circuit", "Saitama", ["omiya", "kawaguchi", "koshigaya", "itabashi"], 2, 5, "The wide northern suburbs: big junctions and long straights."],
  ["circ-tama", "Tama Hills Circuit", "Tama", ["tama", "machida", "sagamihara", "chofu"], 2, 7, "Planned towns on rolling hills, sweepers and short climbs."],
  ["circ-shonan", "Shonan Coast Circuit", "Shonan", ["fujisawa", "kamakura", "hiratsuka"], 2, 6, "Beach roads, surf towns and Mount Fuji's side of the bay."],
];
export const T_SPRINTS = [
  ["spr-ginza", "Ginza to Shibuya", "Central Tokyo", "ginza", "shibuyax", 1, "A short night run across town to warm up."],
  ["spr-skytree", "Tower to Tower", "Minato–Sumida", "tokyotower", "skytree", 2, "From the red tower to the tall silver one, over the river."],
  ["spr-rainbow", "Rainbow Bridge Run", "Tokyo Bay", "shiodome", "odaiba", 2, "Up the ramp and across the bay on the lit-up bridge."],
  ["spr-haneda", "Airport Night Flight", "Haneda", "hnd", "shibuyax", 2, "Out of the terminal and across the city before the next flight lands."],
  ["spr-shuto", "Shuto Expressway Sprint", "Shuto Expressway", "marunouchi", "shinjuku", 3, "Elevated bends and concrete walls: stay on the racing line."],
  ["spr-baybridge", "Bay Bridge Blast", "Yokohama", "kannai", "daikokupa", 3, "The great double-decker bridge out to Daikoku."],
  ["spr-chuo", "Chuo Expressway Run", "Chuo", "shinjuku", "hachioji", 4, "Out of the neon into the western hills on the Chuo."],
  ["spr-keiyo", "Keiyo Road Rush", "Chiba", "ichikawa", "chiba", 4, "East along the bay on the Keiyo Road."],
  ["spr-tohoku", "Tohoku Express Dash", "Saitama", "ueno", "omiya", 4, "North out of the city on the Tohoku Expressway."],
  ["spr-wangan", "Wangan Top Speed", "Bayshore Route", "hnd", "daikokupa", 5, "The Bayshore Route flat out, from the airport to Daikoku."],
  ["spr-tomei", "Tomei Night Run", "Tomei Expressway", "shibuyax", "atsugi", 5, "Out of Shibuya and west on the Tomei, straight into the dark."],
  ["spr-kanetsu", "Kan-etsu Run", "Saitama", "ikebukuro", "kawagoelm", 5, "North-west through Nerima and on to the old castle town."],
  ["spr-miura", "Miura Skyline Sprint", "Miura", "kokusai", "miuratop", 5, "A twisty ridge road on the Miura peninsula."],
  ["spr-takao", "Takao Mountain Sprint", "Hachioji", "hachioji", "takaosummit", 6, "Hairpins up Mount Takao in the dark."],
  ["spr-aqua", "Aqua-Line Crossing", "Tokyo Bay", "keihin", "umihotaru", 6, "Across the bay on the Aqua-Line: sea on both sides and a glowing island in the middle."],
  ["spr-okutama", "Okutama Lake Dash", "Okutama", "tachikawa", "okutamalm", 6, "Up the valley to the lake road, tunnels and tight corners."],
  ["spr-yabitsu", "Yabitsu Pass Sprint", "Tanzawa", "atsugi", "yabitsulm", 7, "The legendary pass: a long climb of blind corners."],
  ["spr-boso", "Boso Skyline Sprint", "Boso", "kisarazu", "bosolm", 7, "The Boso ridge road: rolling hills and open bends."],
  ["spr-marathon", "Tokyo–Odawara Marathon", "Tomei Expressway", "marunouchi", "hiratsuka", 8, "From the heart of Tokyo to the Shonan coast. An endurance run."],
];
export const T_KNOCK = [
  ["ko-ginza", "Ginza Knockout", "Central Tokyo", ["ginza", "shinjuku", "shibuya", "marunouchi", "roppongi"], 2],
  ["ko-bay", "Bay Knockout", "Tokyo Bay", ["odaiba", "toyosu", "shinagawa", "hanedatown", "keihin"], 4],
  ["ko-yokohama", "Yokohama Knockout", "Yokohama", ["kawasaki", "tsurumi", "daikoku", "kannai", "kohoku"], 6],
  ["ko-chiba", "Chiba Knockout", "Chiba", ["funabashi", "makuhari", "chiba", "ichihara", "urayasu"], 7],
];
// [road id, where on it (0..1), name, area, level, iconic]
export const T_DRAGS = [["wangan", 0.5, "Wangan Midnight Drag", "Bayshore Route", 1, true], ["r4", 0.5, "Chuo Expressway Drag", "Chuo", 2], ["r3", 0.5, "Tomei Expressway Drag", "Tomei", 3], ["keno", 0.5, "Ken-O Ring Drag", "Ken-O", 5], ["aqua", 0.5, "Aqua-Line Drag", "Tokyo Bay", 7]];
export const T_DUELS = {
  pixel: ["ginza", "shiodome"], rook: ["keihin", "kawasaki"], nova: ["odaiba", "toyosu"], mako: ["tsurumi", "daikoku"], juno: ["hachioji", "takaosummit"],
  dagger: ["shinjuku", "nakano"], saint: ["tokyotower", "roppongi", "shibuyax"], vex: ["shibuyax", "harajuku", "meijishrine"], nyx: ["shiodome", "rainbow", "odaiba"], kage: ["daikokupa", "baybridge", "kannai", "landmarktower"],
};
export const T_DRIFTS = [["drift-shibuya", "Shibuya Crossing Drift", "shibuyax", 300, 1, [8000, 16000, 26000]], ["drift-daikoku", "Daikoku Pier Drift", "daikokupa", 320, 3, [12000, 24000, 38000]], ["drift-odaiba", "Odaiba Roundabout Drift", "odaiba", 320, 4, [14000, 28000, 44000]], ["drift-keihin", "Keihin Factory Drift", "keihin", 340, 6, [18000, 36000, 56000]], ["drift-takao", "Takao Hairpins", "takaosummit", 320, 5, [16000, 32000, 50000]], ["drift-yabitsu", "Yabitsu Hairpins", "yabitsulm", 380, 7, [20000, 40000, 62000]]];
export const T_TRAPS = [["wangan", 0.4, "Wangan Speed Trap", 1, [150, 180, 215]], ["c1", 0.5, "C1 Loop Trap", 2, [140, 170, 200]], ["rainbow", 0.5, "Rainbow Bridge Trap", 2, [150, 180, 215]], ["r3", 0.4, "Tomei Trap", 3, [165, 195, 230]], ["r4", 0.6, "Chuo Trap", 3, [165, 195, 230]], ["gaikan", 0.5, "Gaikan Trap", 3, [160, 190, 225]], ["aqua", 0.5, "Aqua-Line Trap", 4, [180, 215, 250]], ["keno", 0.5, "Ken-O Trap", 5, [185, 220, 255]]];
export const T_JOBS = [
  ["del-ramen", "Ramen Run", "Shinjuku", "shinjuku", "shibuyax", "Hot ramen for the Shibuya night crowd. Don't spill it — keep it smooth.", 1, 150],
  ["del-parts", "Parts Run", "Akihabara", "akihabara", "daikokupa", "A crate of turbo parts for a Daikoku tuner before dawn.", 2, 210],
  ["del-taxi", "Haneda Rush", "Haneda", "hnd", "roppongihills", "A late flight and a nervous passenger. Drive fast but safe.", 3, 240],
  ["del-film", "Film Reel", "Ginza", "ginza", "meijishrine", "A film print that must reach the studio before midnight.", 4, 330],
  ["del-sample", "Lab Sample", "Yokohama", "landmarktower", "shinjuku", "Medical samples across the bay, no time to lose.", 5, 360],
  ["del-cargo", "Dock Courier", "Keihin", "kannai", "keihin", "Customs papers to the port, before the ship leaves.", 6, 420],
];
export const T_SHOPS = [
  { id: "perf", kind: "perf", name: "Daikoku Performance Garage", at: "daikoku", icon: "🔧", blurb: "Engine, tyres, suspension and nitrous." },
  { id: "visual", kind: "visual", name: "Harajuku Body Shop", at: "harajuku", icon: "🎨", blurb: "Paint, vinyls, body kits, wings, rims and neon." },
  { id: "lot", kind: "lot", name: "Roppongi Car Lot", at: "roppongi", icon: "🚗", blurb: "Buy and swap cars." },
  { id: "audio", kind: "audio", name: "Akihabara Sound Garage", at: "ueno", icon: "🔊", blurb: "Subwoofers, amps and trunk audio systems." },
  { id: "perf2", kind: "perf", name: "Kawasaki Tuning Bay", at: "kawasaki", icon: "🔧", blurb: "Engine, tyres, suspension and nitrous." },
  { id: "home", kind: "home", name: "Your Garage — Ginza", at: "ginza", icon: "🏠", blurb: "Home. Save, change cars, review your career." },
  { id: "visual2", kind: "visual", name: "Yokohama Style Studio", at: "kannai", icon: "🎨", blurb: "Paint, vinyls, body kits, wings, rims and neon." },
];

// Upgrade 34: the iconic touge drift battles. [id, name, road id, where on the road (0..1), ring radius, level, goals, blurb, seconds]
export const T_TOUGE = [
  ["drift-hakone", "Hakone Turnpike: Midnight Drift", "hakone", 0.5, 640, 1, [6000, 12000, 20000], "The legendary Kanagawa mountain road. Hairpin after hairpin in the dark: slide every one and chain them for the multiplier.", 150],
  ["drift-akina", "Mount Akina: Downhill Drift", "akina", 0.5, 640, 6, [18000, 34000, 52000], "The famous downhill of Mount Akina. Blind hairpins, guardrails an inch away, and one clean line to find.", 150],
  ["drift-fuji", "Mount Fuji Skyline: The Summit Drift", "fuji", 0.5, 640, 8, [26000, 46000, 70000], "The high road under Mount Fuji. Long sweepers and tight switchbacks with the mountain watching you.", 160],
];
