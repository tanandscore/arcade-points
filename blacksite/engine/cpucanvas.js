// A drawing canvas that lives in ordinary memory instead of on the graphics card. Reading pixels back from a graphics-card canvas (getImageData)
// makes the browser wait until the card has finished whatever it is drawing, and that wait froze the game for a moment every time a texture was
// made while playing. Every texture drawn for Blacksite is made on one of these, so none of them can cause that wait.
export function cpuCanvas(w, h) {
  const c = document.createElement("canvas"); if (w) c.width = w; if (h) c.height = h;
  const get = c.getContext.bind(c); c.getContext = (type, opts) => get(type, type === "2d" ? { willReadFrequently: true, ...(opts || {}) } : opts);
  return c;
}
