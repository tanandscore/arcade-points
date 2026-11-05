// Upgrade 25: one shared "stop-watch" for the code that builds a city block in small slices (chunks3d.js and plants.js).
// While driving, render.js sets a few-millisecond deadline each frame; the builders pause whenever it has passed. With the default (Infinity) they just run to the end.
export const SL = { t: Infinity };
export const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
