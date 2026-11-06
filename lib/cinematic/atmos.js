// Sky, ambient light from the sky, drifting particles (embers, ash, dust,
// rain), glowing flames and moving water — shared by the flagship games.
import * as THREE from "three";

const NOISE_GLSL = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

// A painted sky: gradient from horizon to zenith, a sun or moon with a glow,
// drifting cloud banks, optional stars. Drawn behind everything.
export function makeSkyDome(o = {}) {
  const u = {
    uZenith: { value: new THREE.Color(o.zenith ?? 0x1b2a4a) }, uMid: { value: new THREE.Color(o.mid ?? 0x4a6a9a) }, uHorizon: { value: new THREE.Color(o.horizon ?? 0xe8c9a0) },
    uSunDir: { value: new THREE.Vector3(...(o.sunDir ?? [0.4, 0.25, -0.8])).normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xffd9a0) },
    uSunSize: { value: o.sunSize ?? 0.012 }, uGlow: { value: o.glow ?? 0.5 }, uCloud: { value: o.cloud ?? 0.6 }, uCloudColor: { value: new THREE.Color(o.cloudColor ?? 0xffffff) },
    uCloudShade: { value: new THREE.Color(o.cloudShade ?? 0x667088) }, uStars: { value: o.stars ?? 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uWind: { value: o.wind ?? 0.004 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }",
    fragmentShader: `
      uniform vec3 uZenith, uMid, uHorizon, uSunDir, uSunColor, uCloudColor, uCloudShade; uniform float uSunSize, uGlow, uCloud, uStars, uTime, uFlash, uWind; varying vec3 vDir;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y, -0.05);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, y)); col = mix(col, uZenith, smoothstep(0.18, 0.85, y));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(sd, 6.0) * 0.28 * uGlow + pow(sd, 48.0) * 0.5 * uGlow);
        float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.55, sd); col = mix(col, uSunColor * 4.0, disc);
        if (d.y > 0.0 && uCloud > 0.0) {
          vec2 cp = d.xz / (d.y + 0.18);
          float n = fbm3(vec3(cp * 1.4 + vec2(uTime * uWind * 8.0, 0.0), 1.7)); float m = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.28, n);
          float lit = clamp(pow(sd, 3.0) * 1.4 + 0.25, 0.0, 1.0);
          vec3 cc = mix(uCloudShade, uCloudColor, lit); cc += uSunColor * pow(sd, 10.0) * 0.5 * (1.0 - n);
          col = mix(col, cc, m * smoothstep(0.0, 0.12, d.y));
        }
        if (uStars > 0.0 && d.y > 0.02) { vec3 sp = floor(d * 320.0); float s = step(0.9965, h31(sp)); col += vec3(s) * uStars * smoothstep(0.02, 0.3, d.y) * (0.6 + 0.4 * sin(uTime * 3.0 + h31(sp) * 40.0)); }
        col += vec3(0.75, 0.85, 1.0) * uFlash * (0.4 + 0.6 * smoothstep(0.0, 0.5, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  mesh.userData.update = (t, camPos) => { u.uTime.value = t; if (camPos) mesh.position.copy(camPos); };
  mesh.userData.uniforms = u;
  return mesh;
}

export function disposeEnvironment(tex) { try { tex && tex.userData && tex.userData.rt && tex.userData.rt.dispose(); } catch {} }
// Light from the sky itself (soft fill that colours every surface correctly).
export function skyEnvironment(renderer, skyMesh) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const clone = skyMesh.clone(); clone.position.set(0, 0, 0); s.add(clone);
  const rt = pm.fromScene(s, 0, 0.1, 1000);
  pm.dispose();
  rt.texture.userData.rt = rt;
  return rt.texture;
}

// Particles that drift through a box around a point, computed on the GPU.
// kind: "ember" (rise, flicker, warm), "ash" (slow fall, grey), "dust" (hang, tiny), "rain" (fast fall), "snow"
export function makeParticles(o = {}) {
  const N = o.count ?? 800, W = o.area ?? 40, H = o.height ?? 20;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = (Math.random() - 0.5) * W;
    seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uArea: { value: W }, uH: { value: H }, uRise: { value: o.rise ?? 1.2 }, uDrift: { value: o.drift ?? 0.8 },
      uSize: { value: o.size ?? 40 }, uColor: { value: new THREE.Color(o.color ?? 0xff8a3a) }, uColor2: { value: new THREE.Color(o.color2 ?? 0xffd27a) }, uFlicker: { value: o.flicker ?? 1 }, uOpacity: { value: o.opacity ?? 1 },
      uWind: { value: new THREE.Vector2(...(o.wind ?? [0.6, 0.2])) }, uStreak: { value: o.streak ?? 0 },
    },
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uArea, uH, uRise, uDrift, uSize, uFlicker, uStreak; uniform vec3 uCenter; uniform vec2 uWind; varying float vA; varying float vM; varying float vS;
      void main(){
        float sp = (0.4 + aSeed.x) * uRise; float t = uTime * sp;
        vec3 p = position;
        p.y = mod(p.y + t + aSeed.y * uH, uH);
        p.x += sin(uTime * (0.3 + aSeed.z) + aSeed.w * 30.0) * uDrift + uWind.x * uTime * 0.2 * sign(uRise);
        p.z += cos(uTime * (0.25 + aSeed.x) + aSeed.z * 30.0) * uDrift + uWind.y * uTime * 0.2 * sign(uRise);
        vec3 w = uCenter + vec3(mod(p.x - uCenter.x + uArea * 0.5, uArea) - uArea * 0.5, p.y, mod(p.z - uCenter.z + uArea * 0.5, uArea) - uArea * 0.5);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        float fade = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(uH * 0.75, uH, p.y));
        float fl = mix(1.0, 0.45 + 0.55 * sin(uTime * (6.0 + aSeed.w * 10.0) + aSeed.z * 40.0), uFlicker);
        vA = fade * fl; vM = aSeed.x; vS = uStreak;
        gl_PointSize = uSize * (0.35 + aSeed.w * 0.65) / max(1.0, -mv.z) * (uStreak > 0.5 ? 0.5 : 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor, uColor2; uniform float uOpacity; varying float vA; varying float vM; varying float vS;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(vec2(c.x * (vS > 0.5 ? 3.0 : 1.0), c.y)); float a = smoothstep(0.5, 0.0, d); a *= a; vec3 col = mix(uColor, uColor2, vM); gl_FragColor = vec4(col * a * vA, a * vA * uOpacity); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  pts.userData.update = (t, center) => { mat.uniforms.uTime.value = t; if (center) mat.uniforms.uCenter.value.set(center.x, o.baseY ?? 0, center.z); };
  return pts;
}

// A soft glowing blob (flames, lamps, muzzle flashes, magic)
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace; return _glowTex;
}
export function makeGlow(color, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, fog: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

// A flickering flame: a few billboards with a light inside
export function makeFlame(color = 0xff7a2a, size = 1) {
  const grp = new THREE.Group();
  const core = makeGlow(0xfff0b0, size * 0.55, 1), halo = makeGlow(color, size * 1.6, 0.8);
  grp.add(halo); grp.add(core);
  grp.userData.update = (t, phase = 0) => {
    const f = 0.85 + 0.15 * Math.sin(t * 17 + phase) * Math.sin(t * 7.3 + phase * 2.1);
    core.scale.set(size * 0.55 * f, size * 0.75 * f, 1); halo.scale.set(size * 1.6 * f, size * 1.9 * f, 1);
    halo.material.opacity = 0.6 + 0.3 * f;
  };
  return grp;
}

// Light shaft / beam: bright at the source, fades along its length and edge
export function makeBeamMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vD = length(mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.2) * pow(clamp(vY, 0.0, 1.0), 1.3) * uOpacity * exp(-vD * 0.006); gl_FragColor = vec4(uColor * a, a); }`,
  });
}

// Moving water: a dark glassy surface with two crossing wave normals.
export function makeWaterMaterial(normalMap, o = {}) {
  const n1 = normalMap.clone(); n1.needsUpdate = true; n1.repeat.set(o.repeat ?? 24, o.repeat ?? 24);
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color ?? 0x0e3a52, roughness: o.roughness ?? 0.06, metalness: 0.0, normalMap: n1, normalScale: new THREE.Vector2(o.bump ?? 0.6, o.bump ?? 0.6),
    transparent: true, opacity: o.opacity ?? 0.92, envMapIntensity: o.env ?? 1.0, clearcoat: 0.3, clearcoatRoughness: 0.2, reflectivity: 0.5,
  });
  m.userData.update = (t) => { n1.offset.set(t * 0.012, t * 0.007); };
  return m;
}
