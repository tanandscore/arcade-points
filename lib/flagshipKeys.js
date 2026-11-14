// Which browser-storage keys each flagship game copies to the player's account (Upgrade 129).
// A key is only synced if it matches one of its game's prefixes, so nothing else can be pushed through the save route.
export const FLAGSHIP_SYNC = {
  midnightburn: ["midnightburn.", "mumbaistreet.", "mb-"],
  operationblacksite: ["blacksite-"],
  kingdomsofash: ["ashtide-"],
  wrathofolympus: ["wrath-"],
};
export const MAX_SAVE_BYTES = 400000; // all keys of one game together
export const MAX_KEY_BYTES = 200000;  // one key
export const keyAllowed = (game, key) => typeof key === "string" && /^[\w.\-]{1,64}$/.test(key) && (FLAGSHIP_SYNC[game] || []).some((p) => key.startsWith(p));
