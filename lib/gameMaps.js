// Every game that has more than one map, and the maps it has. The admin page (/admin/maps) switches
// individual maps on or off; a map that has no saved switch is ON.
// To add a map to the switchboard, add it here (and make that game's map picker call useMapSwitches).
export const GAME_MAPS = {
  operationblacksite: {
    name: "Operation Blacksite",
    maps: [
      { id: "bazaar", name: "Sunstone Bazaar", note: "High noon" },
      { id: "harbor", name: "Harbor Docks", note: "Sunrise" },
      { id: "quarter", name: "Old Quarter", note: "Golden hour" },
      { id: "foundry", name: "Foundry Yard", note: "Night, rain" },
    ],
  },
  midnightburn: {
    name: "Midnight Burn (classic circuits)",
    maps: [
      { id: "harbor", name: "Harbor Loop" },
      { id: "downtown", name: "Downtown Grid" },
      { id: "foundry", name: "Foundry Run" },
      { id: "neonstrip", name: "Neon Strip" },
      { id: "ridge", name: "Skyline Ridge" },
      { id: "eclipse", name: "Eclipse Raceway" },
    ],
  },
};
