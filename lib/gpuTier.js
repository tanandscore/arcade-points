// A quick, safe guess at how strong this device's graphics are, used by the 3D games to choose a sensible starting picture quality.
// Returns 0 (very weak / software drawing), 1 (basic laptop or phone chip), 2 (typical laptop), 3 (strong graphics card).
// It is only a first guess: each game also watches its own frame rate and corrects itself within a few seconds.
export function gpuName(renderer) {
  try { const gl = renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"); return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch { return ""; }
}
export function gpuTier(renderer) {
  const s = gpuName(renderer).toLowerCase(); let t = 2;
  if (/swiftshader|llvmpipe|software|basic render|softpipe|lavapipe|microsoft basic/.test(s)) t = 0;
  else if (/geforce\s*(rtx|gtx\s*(16|20|30|40|10[6-9]|9[6-9]))|rtx|radeon\s*(rx\s*(5[5-9]|[6-9])|pro|vii)|apple m[2-9]|apple m1 (pro|max|ultra)|arc\s*[ab]\d/.test(s)) t = 3;
  else if (/apple m1|apple gpu|geforce\s*gtx|radeon\s*rx|quadro|geforce\s*gt\s*[1-9]\d\d\d?/.test(s)) t = 3;
  else if (/iris\s*xe|iris\(r\)\s*xe|iris\s*plus|xe graphics|vega|radeon\(tm\)\s*graphics|radeon\s*graphics|geforce\s*mx/.test(s)) t = 2;
  else if (/intel|uhd|hd graphics|mali|adreno|powervr|videocore|geforce\s*(gt\s*7|920|930|940)/.test(s)) t = 1;
  if (typeof navigator !== "undefined") { const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8; if (cores <= 2 || mem <= 2) t = Math.min(t, 1); else if (cores <= 4 || mem <= 4) t = Math.min(t, 2); }
  return t;
}
