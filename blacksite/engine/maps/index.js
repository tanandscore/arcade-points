import foundry from "./foundry";
import bazaar from "./bazaar";
import harbor from "./harbor";
import quarter from "./quarter";

export const MAPS = { foundry, bazaar, harbor, quarter };
export const MAP_LIST = [bazaar, harbor, quarter, foundry].map((m) => ({ id: m.id, name: m.name, tagline: m.tagline, time: m.time }));
