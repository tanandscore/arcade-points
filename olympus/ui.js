// Wrath of Olympus — shared look (colors, panels, buttons) for the in-game screen and the menus.
export const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
export const GOLD = "#e3be68", STONE = "#2a2118", STONE2 = "#3b2e20", EDGE = "#a9843c";
export const bar = { background: "linear-gradient(#4a3a27,#2d2217)", border: `1px solid ${EDGE}`, boxShadow: "0 2px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,225,150,.25)", color: "#f3e7c9", fontFamily: FONT };
export const chipBtn = { ...bar, borderRadius: 6, padding: "5px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
export const goldBtn = { ...bar, padding: "12px 38px", fontSize: 18, fontWeight: 900, letterSpacing: 2, borderRadius: 10, cursor: "pointer", color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)", border: "1px solid #fff0b0" };
export const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
export const MENU_BG = "radial-gradient(ellipse at 50% 30%, #5a3d1f 0%, #2a1c10 55%, #0e0905 100%)";
