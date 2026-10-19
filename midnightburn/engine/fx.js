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
  uniforms: { uShadow: { value: new THREE.Vector3(0.90, 1.0, 1.12) }, uHigh: { value: new THREE.Vector3(1.08, 1.0, 0.92) }, uTeal: { value: new THREE.Vector3(0.82, 1.02, 1.22) }, uTealK: { value: 0.5 }, uSat: { value: 1.16 }, uCon: { value: 1.13 }, tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.003 }, uVig: { value: 0.5 }, uGrain: { value: 0.014 }, uBlur: { value: 0 }, uLite: { value: 0 }, uRain: { value: 0 }, uDof: { value: 1 }, uRes: { value: new THREE.Vector2(1280, 720) }, uWarm: { value: new THREE.Vector3(1, 1, 1) }, uWarmK: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uSunCol: { value: new THREE.Vector3(1.0, 0.7, 0.35) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uGrain, uBlur, uLite, uRain, uDof, uTealK, uSat, uCon; uniform vec3 uShadow, uHigh, uTeal, uWarm, uSun, uSunCol; uniform float uWarmK; uniform vec2 uRes; varying vec2 vUv;
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
      // uLite: 0 = the full lens (8 taps, depth of field, rain drops), 0.5 = a lighter lens (3 taps), 1 = one tap (lightest)
      int N = uLite > 0.75 ? 1 : (uLite > 0.25 ? 3 : 8);
      if (N == 1) { acc = texture2D(tDiffuse, uv).rgb; }
      else for(int i = 0; i < 8; i++){
        if (i >= N) break;
        float k = float(i) / float(N - 1);
        vec2 uk = 0.5 + d * (1.0 - blur * k);
        vec2 ca = d * uCA * (0.4 + r);
        acc.r += texture2D(tDiffuse, uk + ca).r;
        acc.g += texture2D(tDiffuse, uk).g;
        acc.b += texture2D(tDiffuse, uk - ca).b;
      }
      vec3 col = acc / float(N);
      float dr = smoothstep(0.30, 0.85, length(uv - 0.5)) * uDof;   // lens depth-of-field feel: the edges of the picture go soft
      if (dr > 0.002 && uLite < 0.25) { vec3 sm = vec3(0.0); for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; sm += texture2D(tDiffuse, uv + vec2(cos(a), sin(a) * uRes.x / uRes.y) * dr * 0.011).rgb; } col = mix(col, sm / 6.0, dr * 0.85); }
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * uShadow, 1.0 - smoothstep(0.0, 0.45, l));   // cool shadows
      col *= mix(vec3(1.0), uHigh, smoothstep(0.35, 1.2, l));          // warm highlights
      col = mix(col, col * uTeal, (1.0 - smoothstep(0.0, 0.3, l)) * uTealK);   // deeper teal-blue shadows
      col *= mix(vec3(1.0), uWarm, uWarmK * smoothstep(0.02, 0.35, l) * (1.0 - smoothstep(0.7, 1.6, l)));   // Most Wanted amber midtones
      if (uSun.z > 0.002) { vec2 sd = (uv - uSun.xy) * vec2(uRes.x / uRes.y, 1.0); float sr = length(sd); col += uSunCol * uSun.z * (0.55 * exp(-sr * 5.5) + 0.35 * exp(-sr * 1.6)); }   // sun glare
      float lum2 = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(lum2), col, uSat);   // richer colour
      col = (col - 0.16) * uCon + 0.16;
      col *= 1.0 - uVig * smoothstep(0.3, 0.95, r * 1.3);
      float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (0.4 + 0.6 * (1.0 - clamp(l * 3.0, 0.0, 1.0)));
      col *= 1.0 - dropShade * 0.12; col += dropShade * 0.025;
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
