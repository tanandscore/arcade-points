// Midnight Burn: Tokyo Drift — famous places. [id, name, latitude, longitude, kind, (road id when the place is a bridge)]
import { ll } from "./tokyoGeo";
const LM = [
  ["tokyotower", "Tokyo Tower", 35.6586, 139.7454, "tokyotower"],
  ["skytree", "Tokyo Skytree", 35.7101, 139.8107, "skytree"],
  ["rainbow", "Rainbow Bridge", 35.6400, 139.7640, "rainbowbridge", "rainbow"],
  ["shibuyax", "Shibuya Crossing", 35.6595, 139.7005, "shibuyax"],
  ["sensoji", "Sensō-ji & Kaminarimon", 35.7148, 139.7967, "sensoji"],
  ["tokyostation", "Tokyo Station", 35.6812, 139.7671, "tokyostation"],
  ["tmg", "Shinjuku Skyscrapers", 35.6896, 139.6917, "shinjukutowers"],
  ["palace", "Imperial Palace Moat", 35.6852, 139.7528, "none"],
  ["meijishrine", "Meiji Shrine Torii", 35.6764, 139.6993, "torii"],
  ["roppongihills", "Roppongi Hills", 35.6605, 139.7292, "none"],
  ["tokyodome", "Tokyo Dome", 35.7056, 139.7519, "none"],
  ["daikokupa", "Daikoku Parking Area", 35.4623, 139.6849, "daikoku"],
  ["odaiba", "Odaiba Ferris Wheel", 35.6264, 139.7845, "ferris"],
  ["bigsight", "Tokyo Big Sight", 35.6300, 139.7945, "bigsight"],
  ["tsukiji", "Tsukiji Outer Market", 35.6655, 139.7707, "none"],
  ["akihabara", "Akihabara Electric Town", 35.6984, 139.7731, "none"],
  ["ueno", "Ueno Park Cherry Blossoms", 35.7141, 139.7741, "sakura"],
  ["landmarktower", "Yokohama Landmark Tower", 35.4545, 139.6317, "landmarktower"],
  ["redbrick", "Yokohama Red Brick Warehouse", 35.4528, 139.6431, "none"],
  ["chinatown", "Yokohama Chinatown", 35.4421, 139.6459, "none"],
  ["baybridge", "Yokohama Bay Bridge", 35.4510, 139.6850, "rainbowbridge", "baybridge"],
  ["tsubasa", "Tsurumi Tsubasa Bridge", 35.4800, 139.6860, "none", "tsubasa"],
  ["keihin", "Keihin Industrial Night Lights", 35.5030, 139.7560, "refinery"],
  ["gatebridge", "Tokyo Gate Bridge", 35.6100, 139.8300, "none", "gate"],
  ["umihotaru", "Umihotaru Parking Area", 35.4635, 139.8730, "umihotaru"],
  ["makuharimesse", "Makuhari Messe", 35.6482, 140.0341, "none"],
  ["chibaport", "Chiba Port Tower", 35.5953, 140.1033, "none"],
  ["maihama", "Maihama Waterfront", 35.6329, 139.8804, "none"],
  ["hnd", "Haneda Airport", 0, 0, "airport"],
  ["takaosummit", "Mount Takao Summit", 35.6254, 139.2436, "none"],
  ["yabitsulm", "Yabitsu Pass Summit", 35.5200, 139.2250, "none"],
  ["okutamalm", "Okutama Lake", 35.8030, 139.1500, "none"],
  ["bosolm", "Boso Skyline Lookout", 35.2850, 140.0300, "none"],
  ["miuratop", "Miura Hills Lookout", 35.2600, 139.6400, "none"],
  ["daibutsu", "Kamakura Great Buddha", 35.3168, 139.5358, "daibutsu"],
  ["enoshima", "Enoshima Island", 35.2990, 139.4800, "none"],
  ["futtsulm", "Futtsu Cape Lookout", 35.3040, 139.8250, "none"],
  ["kawagoelm", "Kawagoe Bell Tower", 35.9251, 139.4858, "none"],
  ["saitamaarena", "Saitama Super Arena", 35.8941, 139.6307, "none"],
  ["showakinen", "Showa Memorial Park Blossoms", 35.7123, 139.3920, "sakura"],
  ["kokusai", "Yokosuka Naval Port", 35.2830, 139.6720, "none"],
  ["sagamiko", "Lake Sagami Viewpoint", 35.6100, 139.2150, "none"],
  ["zojoji", "Zōjō-ji Temple", 35.6574, 139.7488, "temple"], ["tsurugaoka", "Tsurugaoka Hachimangū", 35.3262, 139.5568, "temple"], ["kawasakidaishi", "Kawasaki Daishi Temple", 35.5276, 139.7272, "temple"],
  ["yakuoin", "Takao-san Yakuō-in Temple", 35.6290, 139.2530, "temple"], ["hasedera", "Hase-dera Temple", 35.3125, 139.5330, "temple"],
  ["nezu", "Nezu Shrine Torii Tunnel", 35.7270, 139.7607, "torii"], ["hikawa", "Hikawa Shrine Approach", 35.9227, 139.6320, "torii"],
  ["chidorigafuchi", "Chidorigafuchi Cherry Blossoms", 35.6905, 139.7435, "sakura"], ["meguro", "Meguro River Blossom Avenue", 35.6420, 139.7090, "sakura"], ["sakuraave", "Sakura Parkway, Saitama", 35.8650, 139.6550, "sakura"],
  ["tamariver", "Tama River Riverbank", 35.6120, 139.6200, "none"],
];
export function tokyoLandmarks(AIRPORTS) {
  return LM.map(([id, name, lat, lon, kind, road]) => {
    if (id === "hnd") { const a = AIRPORTS[0]; return { id, name, x: a.x + a.terminal.x, z: a.z + a.terminal.z, kind }; }
    const [x, z] = ll(lat, lon); const o = { id, name, x, z, kind }; if (road) o.bridgeRoad = road; return o;
  });
}
export const TOKYO_PLAZAS = [["Marunouchi", "fountain"], ["Ginza", "fountain"], ["Toyosu", "convention"], ["Shibuya", "casino"], ["Roppongi", "casino"], ["Shinjuku", "fountain"], ["Yokohama", "fountain"], ["Odaiba", "convention"], ["Ueno", "fountain"], ["Kawasaki", "casino"]];
