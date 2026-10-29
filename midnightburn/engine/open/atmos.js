// Midnight Burn — night air (Upgrade 63, "art stage 1").
//
// Real cities at night are never perfectly clear: a thin mist hangs low over the streets, lit from below by the street lamps and
// signs, and it thickens with distance so far blocks fade into a glowing haze while the tops of the towers stand out against the sky.
// Three.js fog is the same at every height, so this adds a low ground mist on top of it: strongest at street level, thinning out
// above roughly a ten-storey building, and warmed by the city's light. Only Midnight Burn's own materials are touched (they carry a
// marker), so no other game on the site changes.
import * as THREE from "three";

let patched = false;
export const ATMOS = { uMist: { value: 0 }, uMistCol: { value: new THREE.Color(0x2a2340) }, uMistH: { value: 22 } };

export function patchFogChunks() {
  if (patched) return; patched = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = C.fog_pars_vertex + "\n#if defined(USE_FOG) && defined(MB_HFOG)\nvarying float vMbWY;\n#endif\n";
  C.fog_vertex = C.fog_vertex + `
#if defined(USE_FOG) && defined(MB_HFOG)
  { vec4 mbW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      mbW = instanceMatrix * mbW;
    #endif
    vMbWY = (modelMatrix * mbW).y; }
#endif
`;
  C.fog_pars_fragment = C.fog_pars_fragment + "\n#if defined(USE_FOG) && defined(MB_HFOG)\nvarying float vMbWY; uniform float uMist; uniform vec3 uMistCol; uniform float uMistH;\n#endif\n";
  C.fog_fragment = C.fog_fragment.replace("gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );", `
  #if defined(MB_HFOG)
    float mbLow = exp(-max(vMbWY - 1.0, 0.0) / uMistH);                       // thick at street level, thin above the rooftops
    float mbFar = 1.0 - exp(-vFogDepth * 0.0024);                               // and thicker with distance
    float mbMist = clamp(mbLow * mbFar * uMist, 0.0, 0.85);
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, uMistCol, mbMist );
  #else
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`);
}

const marked = new WeakSet();
/** Give a material the ground mist (once). Shader materials need the uniforms passed through; standard ones get them at compile. */
export function markMist(m) {
  if (!m || marked.has(m) || !m.fog || m.isSpriteMaterial) return; marked.add(m);
  if (m.isShaderMaterial) return; // custom shaders (glows, beams, sky) keep their own look
  m.defines = { ...(m.defines || {}), MB_HFOG: "" };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); sh.uniforms.uMist = ATMOS.uMist; sh.uniforms.uMistCol = ATMOS.uMistCol; sh.uniforms.uMistH = ATMOS.uMistH; };
  const prevKey = m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.customProgramCacheKey = () => (prevKey ? prevKey() : "") + "|mbMist";
  m.needsUpdate = true;
}
/** Walk the scene now and then and give any new materials the mist. */
export function markSceneMist(root) {
  root.traverse((o) => { const ms = o.material; if (!ms) return; if (Array.isArray(ms)) ms.forEach(markMist); else markMist(ms); });
}
