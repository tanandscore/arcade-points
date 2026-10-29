// Midnight Burn — rooms behind the windows (Upgrade 63, "art stage 1").
//
// Until now every window was a flat picture painted on the wall. This turns each window into a real-looking room: the shader works out
// where your eye's line through the glass would hit the room's back wall, floor, ceiling and side walls, and draws them in 3D, so the
// rooms shift with perspective as you drive past (the trick big open-world games use for whole cities of lit windows). Each room gets
// its own wall colour, a ceiling light, furniture shapes, sometimes a person, blinds or curtains, and a few unlit rooms flicker blue
// from a TV. Lit or dark follows the painted facade, so the city keeps its existing pattern of lights. The glass keeps its reflections
// on top, and at shallow angles the reflection takes over, as real glass does.
//
// Cost: a handful of maths per window pixel and one extra texture read. It switches off below the GOOD quality step.
export function addInteriors(mat, cell, shared) {
  const cw = cell.w, ch = cell.h, depth = cell.depth || 3.6;
  mat.defines = { ...(mat.defines || {}), MB_INTERIOR: "" };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uIntK = shared.uIntK; sh.uniforms.uIntTime = shared.uTime;
    sh.uniforms.uCell = { value: [cw, ch] }; sh.uniforms.uRoomD = { value: depth };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uIntK; uniform float uIntTime; uniform vec2 uCell; uniform float uRoomD;\n" + ROOM_FN)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + ROOM_MAIN);
  };
  mat.customProgramCacheKey = () => "mbInterior" + cw + "x" + ch;
  mat.needsUpdate = true;
  return mat;
}

const ROOM_FN = `
float mbH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 mbRoom(vec2 cid, vec2 f, vec3 d, vec3 lightCol, float lit, float t){
  // the room is a box behind the window: x across the cell, y up the cell, z into the building (all in metres)
  vec3 p = vec3(f.x * uCell.x, f.y * uCell.y, 0.0);
  float BIG = 1e4;
  float tx = d.x > 0.0005 ? (uCell.x - p.x) / d.x : (d.x < -0.0005 ? -p.x / d.x : BIG);
  float ty = d.y > 0.0005 ? (uCell.y - p.y) / d.y : (d.y < -0.0005 ? -p.y / d.y : BIG);
  float tz = uRoomD / max(-d.z, 0.0005);
  float tt = min(tx, min(ty, tz)); vec3 hp = p + d * tt;
  float h1 = mbH(cid), h2 = mbH(cid + 17.3), h3 = mbH(cid + 41.9), h4 = mbH(cid + 7.7);
  vec3 wall = mix(vec3(0.82, 0.78, 0.70), vec3(0.55 + 0.4 * h2, 0.55 + 0.35 * h3, 0.5 + 0.4 * h1), 0.35);
  vec3 floorC = mix(vec3(0.32, 0.24, 0.17), vec3(0.42, 0.42, 0.44), step(0.5, h3));
  vec3 alb; float shade;
  float depthK = clamp(-hp.z / uRoomD, 0.0, 1.0);
  if (tt == tz) {             // back wall: furniture shapes and sometimes a person standing in the room
    vec2 b = hp.xy / uCell;
    alb = wall; shade = 0.85;
    float shelf = step(0.15 + 0.3 * h2, b.x) * step(b.x, 0.45 + 0.3 * h2) * step(b.y, 0.55 + 0.2 * h3);
    alb = mix(alb, vec3(0.16, 0.12, 0.10), shelf * step(0.35, h4));
    float art = step(abs(b.x - (0.3 + 0.4 * h1)), 0.09) * step(abs(b.y - 0.66), 0.08);
    alb = mix(alb, vec3(0.6 * h3 + 0.2, 0.3 + 0.4 * h1, 0.25 + 0.5 * h2), art * step(h4, 0.6));
    float tv = step(abs(b.x - 0.62), 0.12) * step(abs(b.y - 0.42), 0.07);
    alb = mix(alb, vec3(0.05, 0.08, 0.14), tv * step(0.55, h1));
  } else if (tt == ty) {     // floor (looking down into the room) or ceiling (looking up)
    if (d.y < 0.0) { alb = floorC; shade = 0.55 + 0.25 * depthK; float rug = step(abs(hp.x / uCell.x - 0.5), 0.25) * step(abs(-hp.z / uRoomD - 0.55), 0.25); alb = mix(alb, vec3(0.45 * h2 + 0.2, 0.15 + 0.2 * h3, 0.18), rug * step(0.4, h1)); }
    else { alb = vec3(0.92); shade = 1.15; float lamp = smoothstep(0.22, 0.0, length(vec2(hp.x / uCell.x - 0.5, -hp.z / uRoomD - 0.5))); shade += lamp * 1.3; }
  } else {                   // side walls
    alb = wall * 0.92; shade = 0.7 + 0.2 * depthK;
  }
  // a desk or sofa along the back, and a person silhouette in some rooms, seen against the far wall
  float sil = 0.0;
  if (h3 > 0.8) { float px = 0.25 + 0.5 * fract(h2 * 7.0 + t * 0.01); vec2 b = hp.xy / uCell; float body = step(abs(b.x - px), 0.06) * step(b.y, 0.55) * step(0.0, b.y); float head = step(length((b - vec2(px, 0.62)) * vec2(1.0, 1.4)), 0.05); sil = max(body, head) * step(0.9, depthK); }
  float vign = 1.0 - 0.35 * smoothstep(0.25, 0.75, length(hp.xy / uCell - vec2(0.5, 0.7)));
  vec3 lc = lightCol * (0.32 + 0.42 * h4);   // rooms differ: a bright office, a dim bedroom, a lamp in the corner
  vec3 litRoom = alb * lc * shade * vign * (1.15 - 0.45 * depthK);
  litRoom = mix(litRoom, vec3(0.02, 0.018, 0.02), sil * 0.9);
  // unlit rooms: almost black, a little blue from the sky; one in a dozen flickers with a television
  float tvOn = step(0.92, h4) * (0.6 + 0.4 * sin(t * 7.0 + h1 * 40.0) * sin(t * 3.1 + h2 * 20.0));
  vec3 darkRoom = alb * (vec3(0.010, 0.013, 0.022) + vec3(0.10, 0.16, 0.32) * tvOn * (1.0 - 0.6 * depthK));
  return mix(darkRoom, litRoom, lit);
}
`;

const ROOM_MAIN = `
#ifdef MB_INTERIOR
if (uIntK > 0.001) {
  float rgh = texture2D(roughnessMap, vRoughnessMapUv).g;
  float glass = 1.0 - smoothstep(0.17, 0.30, rgh);          // the glass panes are the smooth parts of the facade
  if (glass > 0.01) {
    vec2 cuv = vMapUv * 8.0; vec2 cid = floor(cuv); vec2 f = fract(cuv);
    vec3 pos = -vViewPosition;
    vec3 dp1 = dFdx(pos), dp2 = dFdy(pos); vec2 du1 = dFdx(vMapUv), du2 = dFdy(vMapUv);
    vec3 Ng = normalize(cross(dp1, dp2)); if (dot(Ng, vViewPosition) < 0.0) Ng = -Ng;  // flat wall normal, facing the camera
    vec3 dp2p = cross(dp2, Ng), dp1p = cross(Ng, dp1);
    vec3 Tv = normalize(dp2p * du1.x + dp1p * du2.x), Bv = normalize(dp2p * du1.y + dp1p * du2.y);
    vec3 rd = normalize(pos);
    vec3 d = vec3(dot(rd, Tv), dot(rd, Bv), dot(rd, Ng));
    // is this room lit, and what colour is its light? read the painted window at the middle of the pane
    vec3 em = texture2D(emissiveMap, (cid + vec2(0.5, 0.62)) / 8.0).rgb;
    float mx = max(em.r, max(em.g, em.b)); float lit = smoothstep(0.08, 0.3, mx);
    vec3 lightCol = em / max(mx, 0.001);
    vec3 room = mbRoom(cid, f, d, lightCol, lit, uIntTime);
    float face = clamp(-d.z, 0.0, 1.0); float k = glass * uIntK * mix(0.35, 1.0, smoothstep(0.1, 0.6, face));
    totalEmissiveRadiance = mix(totalEmissiveRadiance, room * emissive * 1.3, k);
    diffuseColor.rgb *= 1.0 - 0.75 * k;   // the glass itself is dark; what you see is the room behind it and the reflection on it
  }
}
#endif
`;
