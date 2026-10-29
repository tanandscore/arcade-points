// The four big 3D games. They are laptop/desktop only and share the fullscreen stage.
export const LAPTOP_ONLY_SLUGS = ["kingdomsofash", "wrathofolympus", "operationblacksite", "midnightburn"];

// Legend Pass holds ONLY these four flagship games (Upgrade 70). The database says so too (migration_078), but the site also
// enforces it in code (lib/games.js + lib/catalog.js), so a wrong edit in the database can never unlock them for free.
export const LEGEND_FLAGSHIP_SLUGS = ["midnightburn", "operationblacksite", "kingdomsofash", "wrathofolympus"];
export const LEGEND_PLAN_ID = "premium_plus";
export const POWER_PLAN_ID = "premium";
