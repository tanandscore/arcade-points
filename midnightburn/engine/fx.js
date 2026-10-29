// Midnight Burn — realism helpers: believable asphalt, soft contact
// shadows, light cones, and the final "camera" pass (lens colour, film
// grain, vignette, speed blur). Everything is generated in code.
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { makeRng } from "./physics.js";

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// ---- asphalt: colour + roughness + bump, all from the same noise ----------
export function makeAsphalt(wet, seed = 7) {
  const S = 512;
  const rng = makeRng(seed);
  const col = cv(S, S), rgh = cv(S, S), hgt = cv(S, S);
  const c = col.getContext("2d"), r = rgh.getContext("2d"), h = hgt.getContext("2d");

  // base: slow tonal blotches over fine grit
  c.fillStyle = "#2b2b34"; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = rng() * S, y = rng() * S, rad = 30 + rng() * 90, v = 30 + rng() * 22;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v},${v + 4},0.55)`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  r.fillStyle = wet ? "rgb(122,122,122)" : "rgb(200,200,200)"; r.fillRect(0, 0, S, S);
  h.fillStyle = "rgb(128,128,128)"; h.fillRect(0, 0, S, S);
  for (let i = 0; i < 16000; i++) {
    const x = rng() * S, y = rng() * S, v = 24 + Math.floor(rng() * 62), sz = 0.7 + rng() * 1.7;
    c.fillStyle = `rgba(${v},${v},${v + 5},0.75)`; c.fillRect(x, y, sz, sz);
    const hv = 90 + Math.floor(rng() * 90);
    h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(x, y, sz, sz);
  }
  // lighter aggregate chips
  for (let i = 0; i < 1400; i++) {
    const x = rng() * S, y = rng() * S, v = 60 + Math.floor(rng() * 60);
    c.fillStyle = `rgba(${v},${v},${v + 8},0.55)`; c.fillRect(x, y, 1.4, 1.4);
  }
  // patched strips (repair work)
  for (let i = 0; i < 5; i++) {
    const x = rng() * S, y = rng() * S, w = 40 + rng() * 150, hh = 18 + rng() * 80;
    c.fillStyle = `rgba(6,6,9,0.45)`; c.fillRect(x, y, w, hh);
    c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.5; c.strokeRect(x, y, w, hh);
    h.fillStyle = "rgb(118,118,118)"; h.fillRect(x, y, w, hh);
    h.strokeStyle = "rgb(70,70,70)"; h.lineWidth = 2; h.strokeRect(x, y, w, hh);
    r.fillStyle = wet ? "rgb(60,60,60)" : "rgb(150,150,150)"; r.fillRect(x, y, w, hh);
  }
  // cracks
  for (let i = 0; i < 14; i++) {
    let x = rng() * S, y = rng() * S, a = rng() * Math.PI * 2;
    c.strokeStyle = "rgba(0,0,0,0.75)"; c.lineWidth = 0.8 + rng() * 1.2;
    h.strokeStyle = "rgb(40,40,40)"; h.lineWidth = 2;
    c.beginPath(); h.beginPath(); c.moveTo(x, y); h.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (rng() - 0.5) * 1.0; x += Math.cos(a) * (8 + rng() * 14); y += Math.sin(a) * (8 + rng() * 14); c.lineTo(x, y); h.lineTo(x, y); }
    c.stroke(); h.stroke();
  }
  // polished tyre lanes: darker, smoother
  for (const f of [0.28, 0.36, 0.64, 0.72]) {
    const x = S * f - 14;
    const g = c.createLinearGradient(x, 0, x + 28, 0);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(4,4,7,0.38)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x, 0, 28, S);
    const g2 = r.createLinearGradient(x, 0, x + 28, 0);
    g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(0.5, wet ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    r.fillStyle = g2; r.fillRect(x, 0, 28, S);
  }
  // oil drips and rubber
  for (let i = 0; i < 9; i++) {
    const x = rng() * S, y = rng() * S, rad = 8 + rng() * 22;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(2,2,5,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    r.fillStyle = "rgba(0,0,0,0)";
  }
  // puddles: mirror-smooth, flat, slightly darker
  const pud = wet ? 14 : 3;
  for (let i = 0; i < pud; i++) {
    const x = rng() * S, y = rng() * S, rx = 20 + rng() * 60, ry = 10 + rng() * 34, rot = rng() * Math.PI;
    for (const [ctx, style] of [[r, "rgba(0,0,0,1)"], [h, "rgba(128,128,128,1)"], [c, "rgba(3,3,8,0.5)"]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
      g.addColorStop(0, style); g.addColorStop(0.7, style.replace(/,1\)/, ",0.9)").replace(/,0\.5\)/, ",0.45)")); g.addColorStop(1, style.replace(/,[\d.]+\)$/, ",0)"));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  // road paint, worn through
  const paint = (x, w, y0, y1, color) => {
    c.fillStyle = color; c.fillRect(x, y0, w, y1 - y0);
    r.fillStyle = wet ? "rgb(70,70,70)" : "rgb(160,160,160)"; r.fillRect(x, y0, w, y1 - y0);
  };
  paint(S * 0.02, 9, 0, S, "#d8d8e0"); paint(S * 0.98 - 9, 9, 0, S, "#d8d8e0");
  for (const f of [0.25, 0.75]) paint(S * f - 4, 8, 0, S * 0.45, "#d8d8e0");
  paint(S * 0.5 - 12, 7, 0, S, "#e8b92e"); paint(S * 0.5 + 6, 7, 0, S, "#e8b92e");
  // wear: punch speckle holes out of the paint
  for (let i = 0; i < 2600; i++) {
    const x = rng() * S, y = rng() * S, sz = 1 + rng() * 2.6;
    const near = [0.02, 0.98, 0.25, 0.75, 0.5].some((f) => Math.abs(x - S * f) < 16);
    if (!near) continue;
    c.fillStyle = `rgba(${18 + rng() * 14},${18 + rng() * 14},${22 + rng() * 14},0.9)`; c.fillRect(x, y, sz, sz);
  }

  // normal map from the height canvas
  const hd = h.getImageData(0, 0, S, S).data;
  const nrm = cv(S, S), n = nrm.getContext("2d");
  const out = n.createImageData(S, S);
  const H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.6, dy = (H(x, y + 1) - H(x, y - 1)) * 2.6;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  n.putImageData(out, 0, 0);

  const mk = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(col, true), roughnessMap: mk(rgh, false), normalMap: mk(nrm, false) };
}

// ---- soft blob that sits under a car and grounds it ---------------------------
export function makeBlobShadow() {
  const c = cv(128, 128), g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,0.95)"); gr.addColorStop(0.55, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// fade used on lamp and headlight light cones (bright at the tip, where the light is)
export function makeConeFade() {
  const c = cv(8, 128), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(0.35, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// ---- the "camera": colour grade, chromatic fringe, grain, vignette, speed blur
const GradeShader = {
  uniforms: { uShadow: { value: new THREE.Vector3(0.90, 1.0, 1.12) }, uHigh: { value: new THREE.Vector3(1.08, 1.0, 0.92) }, uTeal: { value: new THREE.Vector3(0.82, 1.02, 1.22) }, uTealK: { value: 0.5 }, uSat: { value: 1.16 }, uCon: { value: 1.13 }, tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.003 }, uVig: { value: 0.5 }, uGrain: { value: 0.014 }, uBlur: { value: 0 }, uStreak: { value: 0 }, uFlash: { value: 0 }, uLite: { value: 0 }, uSharp: { value: 0 }, uRain: { value: 0 }, uDof: { value: 1 }, uRes: { value: new THREE.Vector2(1280, 720) }, uWarm: { value: new THREE.Vector3(1, 1, 1) }, uWarmK: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uSunCol: { value: new THREE.Vector3(1.0, 0.7, 0.35) }, uFlare: { value: 0 }, uFlareCol: { value: new THREE.Vector3(0.32, 0.58, 1.0) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uGrain, uBlur, uLite, uRain, uDof, uTealK, uSat, uCon, uSharp, uStreak, uFlash, uFlare; uniform vec3 uFlareCol; uniform vec3 uShadow, uHigh, uTeal, uWarm, uSun, uSunCol; uniform float uWarmK; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float dropShade = 0.0;
      if (uRain > 0.05 && uLite < 0.25) {   // raindrops on the lens: each grid cell may hold one round drop that bends the picture
        vec2 g = vec2(16.0 * (uRes.x / uRes.y) / 1.78, 16.0); vec2 id = floor(uv * g); vec2 f = fract(uv * g) - 0.5;
        float h = hash(id); float life = fract(uTime * 0.05 + h * 7.0); float on = step(1.0 - uRain * 0.35, hash(id + 3.1));
        vec2 c = vec2(hash(id + 1.7) - 0.5, hash(id + 5.3) - 0.5) * 0.5; c.y -= life * 0.15; float rr = length(f - c); float rad = 0.07 + 0.1 * h;
        float dm = on * smoothstep(rad, rad * 0.4, rr); uv += (f - c) * dm * 0.05; dropShade = dm;
      }
      vec2 d = uv - 0.5; float r = length(d);
      float blur = uBlur * r * r * 2.2;
      vec3 acc = vec3(0.0);
      // uLite: 0 = the full lens (depth of field, rain drops), 0.5 = a lighter lens, 1 = the lightest (one plain read)
      // The radial speed blur needs several reads of the picture, but only while it is actually on (driving fast). The rest of the time every read would land on the same spot, so one set is enough: same picture, a fraction of the work.
      int N = uLite > 0.75 ? 1 : ((uLite > 0.25 ? 3 : 8));
      if (uBlur < 0.0008) N = 1;
      if (uLite > 0.75) { acc = texture2D(tDiffuse, uv).rgb; }
      else if (N == 1) { vec2 ca = d * uCA * (0.4 + r); acc = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b); }
      else for(int i = 0; i < 8; i++){
        if (i >= N) break;
        vec2 ca = d * uCA * (0.4 + r);
        float k = float(i) / float(N - 1);
        vec2 uk = 0.5 + d * (1.0 - blur * k);
        acc.r += texture2D(tDiffuse, uk + ca).r;
        acc.g += texture2D(tDiffuse, uk).g;
        acc.b += texture2D(tDiffuse, uk - ca).b;
      }
      vec3 col = acc / float(N);
      float shp = 0.0; if (uSharp > 0.001) shp = uSharp * (1.0 - smoothstep(0.0008, 0.02, uBlur));   // fades out smoothly as the speed blur comes in
      if (shp > 0.001) {   // sharpening: brings back the fine detail (road markings, window grids, signs, wires) that a lower render size and edge smoothing take away. Worked out in a perceptual space and capped, so bright lamps get no halos.
        vec2 px = 1.0 / uRes;
        vec3 nb = (texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb) * 0.25;
        vec3 sa = sqrt(max(col, 0.0)), sb = sqrt(max(nb, 0.0));
        vec3 sc = max(sa + clamp((sa - sb) * shp, vec3(-0.055), vec3(0.06)), 0.0);
        col = sc * sc;
      }
      float dr = smoothstep(0.40, 0.92, length(uv - 0.5)) * uDof;   // lens depth-of-field feel: only the far edges of the picture go a little soft (it used to start earlier and blur much harder, which read as a hazy picture)
      if (dr > 0.002 && uLite < 0.25) { vec3 sm = vec3(0.0); for (int i = 0; i < 4; i++) { float a = 0.785 + float(i) * 1.5708; sm += texture2D(tDiffuse, uv + vec2(cos(a), sin(a) * uRes.x / uRes.y) * dr * 0.006).rgb; } col = mix(col, sm * 0.25, dr * 0.6); }
      if (uFlare > 0.001 && uLite < 0.25) {   // Upgrade 62: anamorphic lens streaks. Every very bright point (headlamps, tail lamps, neon tubes, street lamps) throws a long thin horizontal streak, like a cinema lens.
        vec3 fl = vec3(0.0); float asp = uRes.y / uRes.x;
        for (int i = 1; i <= 14; i++) { float fi = float(i); float o = fi * 0.0068 * asp * 1.6; float w = 1.0 - fi / 15.0;   // evenly spaced taps, so a streak is a smooth line, never a row of copies
          vec3 a = texture2D(tDiffuse, uv + vec2(o, 0.0)).rgb, b = texture2D(tDiffuse, uv - vec2(o, 0.0)).rgb;
          fl += (max(a - 1.6, 0.0) + max(b - 1.6, 0.0)) * w * w; }   // only the truly bright points (lamps, headlights, neon cores), not lit windows
        float fs = dot(fl, vec3(0.333)); col += uFlareCol * fs * uFlare * 0.22 + fl * uFlare * 0.04;
        // a soft ring of light (a lens 'ghost') mirrored across the middle of the picture from the brightest light nearby
        vec2 gv = 1.0 - uv; vec3 gh = max(texture2D(tDiffuse, mix(gv, vec2(0.5), 0.35)).rgb - 1.1, 0.0);
        col += gh * vec3(0.55, 0.35, 1.0) * uFlare * 0.1 * smoothstep(0.55, 0.1, length(uv - 0.5));
      }
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * uShadow, 1.0 - smoothstep(0.0, 0.45, l));   // cool shadows
      col *= mix(vec3(1.0), uHigh, smoothstep(0.35, 1.2, l));          // warm highlights
      col = mix(col, col * uTeal, (1.0 - smoothstep(0.0, 0.3, l)) * uTealK);   // deeper teal-blue shadows
      col *= mix(vec3(1.0), uWarm, uWarmK * smoothstep(0.02, 0.35, l) * (1.0 - smoothstep(0.7, 1.6, l)));   // Most Wanted amber midtones
      if (uSun.z > 0.002) { vec2 sd = (uv - uSun.xy) * vec2(uRes.x / uRes.y, 1.0); float sr = length(sd); col += uSunCol * uSun.z * (0.55 * exp(-sr * 5.5) + 0.35 * exp(-sr * 1.6)); }   // sun glare
      float lum2 = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(lum2), col, uSat);   // richer colour
      col = (col - 0.16) * uCon + 0.16;
      if (uStreak > 0.004 && uLite < 0.75) {   // Upgrade 39: speed streaks (skipped on the lightest quality setting). Thin pale lines rush outwards from the middle of the picture and only show near the edges, like the lamps and posts smearing past at speed. Cheap: no extra picture reads.
        vec2 sd = uv - 0.5; sd.x *= uRes.x / uRes.y; float rr = length(sd);
        float an = atan(sd.y, sd.x) / 6.2831853 * 110.0;
        float id = floor(an + 0.5); float h = hash(vec2(id, 7.0)); float fa = fract(an + 0.5) - 0.5;
        float line = smoothstep(mix(0.06, 0.17, h), 0.01, abs(fa));
        float tt = fract(uTime * (1.5 + h * 1.6) + h * 5.0); float head = mix(0.2, 1.15, tt); float len = 0.12 + h * 0.26;
        float along = smoothstep(head - len, head, rr) * (1.0 - smoothstep(head, head + 0.025, rr));
        float lit = step(0.5, hash(vec2(id, floor(uTime * 1.9 + h * 9.0))));
        col += mix(vec3(0.9, 0.82, 0.7), vec3(0.55, 0.8, 1.0), clamp(uFlash + uStreak - 0.6, 0.0, 1.0)) * line * along * smoothstep(0.28, 0.8, rr) * lit * uStreak * 0.5;
      }
      col *= 1.0 - uVig * smoothstep(0.3, 0.95, r * 1.3);
      float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (0.4 + 0.6 * (1.0 - clamp(l * 3.0, 0.0, 1.0)));
      col *= 1.0 - dropShade * 0.12; col += dropShade * 0.025;
      if (uFlash > 0.003) col += vec3(0.08, 0.26, 0.7) * uFlash * (0.04 + 0.55 * smoothstep(0.35, 1.0, r * 1.3));   // Upgrade 39: the nitrous slam, a blue flash that floods in from the edges
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
export function makeGradePass() { return new ShaderPass(GradeShader); }

// A soft light cone: brightest at the lamp, fading out along its length and
// towards its edges so it reads as light in the air, not as a solid shape.
export function makeBeamMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        vec4 p = vec4(position, 1.0);
        mat3 nm = mat3(1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; nm = mat3(instanceMatrix);
        #endif
        vec4 mv = modelViewMatrix * p;
        vN = normalize(normalMatrix * nm * normal);
        vV = -mv.xyz; vD = length(mv.xyz); vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(f, 2.2) * pow(clamp(vY, 0.0, 1.0), 1.3) * uOpacity * exp(-vD * 0.006);
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}
