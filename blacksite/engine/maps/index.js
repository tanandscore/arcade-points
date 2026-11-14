import foundryBase from "./foundry";
import bazaarBase from "./bazaar";
import harborBase from "./harbor";
import quarterBase from "./quarter";
import { expand } from "./expand";
import { foundryPad, foundryX, bazaarPad, bazaarX, harborPad, harborX, quarterPad, quarterX } from "./extras";

// Upgrade 119: every map is grown and given outer lanes, rim roads, long tunnels and secret shortcuts (see extras.js)
const foundry = expand(foundryBase, foundryPad, foundryX);
const bazaar = expand(bazaarBase, bazaarPad, bazaarX);
const harbor = expand(harborBase, harborPad, harborX);
const quarter = expand(quarterBase, quarterPad, quarterX);

export const MAPS = { foundry, bazaar, harbor, quarter };
export const MAP_LIST = [bazaar, harbor, quarter, foundry].map((m) => ({ id: m.id, name: m.name, tagline: m.tagline, time: m.time }));
