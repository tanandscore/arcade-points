// Midnight Burn — searchlights (Upgrade 26).
// The old sky beams were two hard-edged cones nailed in place. These are soft: bright where they leave the lamp, thinning out as they climb, with feathered
// edges, and every beam turns slowly round the sky (the two over a casino turn opposite ways, so they cross and part) while its tilt breathes in and out.
// They only burn at night. One cheap shape per beam, drawn from the front only, so they cost almost nothing even on a weak graphics card.
import * as THREE from "three";

const H = 640;
const VERT = `
varying vec3 vN; varying vec3 vV; varying float vH;
void main() {
  vH = position.y / ${H.toFixed(1)};
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = `
uniform vec3 uCol; uniform float uK;
varying vec3 vN; varying vec3 vV; varying float vH;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));       // 1 in the middle of the beam as you see it, 0 at its edges
  float edge = pow(f, 1.25);
  float h = clamp(vH, 0.0, 1.0);
  float climb = pow(1.0 - h, 1.0);                         // fades away as it rises
  float foot = smoothstep(0.0, 0.025, h);                  // no hard line where it leaves the lamp
  float a = uK * edge * climb * foot;
  gl_FragColor = vec4(uCol * a, a);
}`;

// beams: [x, y, z, tilt, spin direction]. Returns { group, update(clock, nightK) }.
export function buildBeams(beams) {
  const group = new THREE.Group(); group.name = "searchlights";
  if (!beams.length) return { group, update() {} };
  const geo = new THREE.CylinderGeometry(24, 2.4, H, 16, 1, true); geo.translate(0, H / 2, 0); // narrow at the lamp, widening as it climbs
  const cols = [0xa9dcff, 0xffe2a0, 0xffb3e6]; const items = [];
  beams.forEach(([bx, by, bz, tl, dir], k) => {
    const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(cols[(k >> 1) % cols.length]) }, uK: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    const pivot = new THREE.Group(); pivot.position.set(bx, by, bz);
    const lean = new THREE.Group(); const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; lean.add(m); pivot.add(lean); group.add(pivot);
    const ph = (bx * 0.013 + bz * 0.007 + k * 1.9) % (Math.PI * 2);
    items.push({ pivot, lean, mat, tl: Math.abs(tl), ph, w: (dir || (k % 2 ? 1 : -1)) * (0.16 + ((k * 37) % 7) * 0.012), bx, bz });
  });
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const update = (clock, nightK, camX, camZ) => {
    const on = smooth(0.12, 0.65, nightK);
    for (const b of items) {
      const far = camX === undefined ? 0 : Math.hypot(b.bx - camX, b.bz - camZ);
      const vis = on > 0.01 && far < 6500;
      if (b.pivot.visible !== vis) b.pivot.visible = vis;
      if (!vis) continue;
      b.pivot.rotation.y = b.ph + clock * b.w;                                    // slow turn round the sky
      b.lean.rotation.z = b.tl * (0.78 + 0.32 * Math.sin(clock * 0.21 + b.ph * 2)); // tilt breathes in and out
      b.mat.uniforms.uK.value = 0.62 * on * (0.9 + 0.1 * Math.sin(clock * 1.3 + b.ph));
    }
  };
  return { group, update };
}
