// Shared "camera" for the flagship 3D games: soft glow around bright things,
// a filmic colour grade, a darkened frame edge, a touch of lens fringing and
// film grain. Falls back to a plain render if the post-processing chain can't
// be built (very old graphics cards).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.0012 }, uVig: { value: 0.45 }, uGrain: { value: 0.016 },
    uSat: { value: 1.0 }, uContrast: { value: 1.06 }, uShadow: { value: new THREE.Vector3(0.94, 1.0, 1.08) }, uHigh: { value: new THREE.Vector3(1.07, 1.0, 0.92) },
    uFlash: { value: 0 }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) }, uBlur: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uGrain, uSat, uContrast, uFlash, uBlur; uniform vec3 uShadow, uHigh, uFlashColor; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = uv - 0.5; float r = length(d);
      vec3 col;
      float blur = uBlur * r * r * 2.0;
      if (blur > 0.001) {
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 6; i++) { float k = float(i) / 5.0; acc += texture2D(tDiffuse, 0.5 + d * (1.0 - blur * k)).rgb; }
        col = acc / 6.0;
      } else {
        vec2 ca = d * uCA * (0.5 + r);
        col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      }
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * uShadow, 1.0 - smoothstep(0.0, 0.45, l));
      col *= mix(vec3(1.0), uHigh, smoothstep(0.35, 1.2, l));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.18) * uContrast + 0.18;
      col += uFlashColor * uFlash;
      col *= 1.0 - uVig * smoothstep(0.3, 0.95, r * 1.3);
      float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (0.4 + 0.6 * (1.0 - clamp(l * 3.0, 0.0, 1.0)));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createCinematic(renderer, scene, camera, opts = {}) {
  const {
    exposure = 1.0, bloom = [0.55, 0.6, 0.78], samples = 4, grade = {},
  } = opts;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const el = renderer.domElement;
  let w = el.clientWidth || 1280, h = el.clientHeight || 720;
  let composer = null, gradePass = null, bloomPass = null;
  try {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.floor(w * pr), Math.floor(h * pr), { type: THREE.HalfFloatType, samples });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom[0], bloom[1], bloom[2]);
    composer.addPass(bloomPass);
    gradePass = new ShaderPass(GradeShader);
    gradePass.uniforms.uRes.value.set(w * pr, h * pr);
    for (const k of Object.keys(grade)) {
      const u = gradePass.uniforms["u" + k[0].toUpperCase() + k.slice(1)];
      if (!u) continue;
      if (Array.isArray(grade[k])) u.value.set(...grade[k]); else u.value = grade[k];
    }
    composer.addPass(gradePass);
    composer.addPass(new OutputPass());
    composer.setSize(w, h);
  } catch { composer = null; gradePass = null; bloomPass = null; }

  let t = 0;
  return {
    composer, grade: gradePass ? gradePass.uniforms : null, bloom: bloomPass,
    render(dt = 0.016) {
      t += dt;
      if (composer && gradePass) { gradePass.uniforms.uTime.value = t; composer.render(dt); } else renderer.render(scene, camera);
    },
    setSize(nw, nh) {
      w = nw; h = nh;
      if (composer) {
        composer.setSize(nw, nh);
        if (gradePass) { const pr = renderer.getPixelRatio(); gradePass.uniforms.uRes.value.set(nw * pr, nh * pr); }
      }
    },
    dispose() { try { composer && composer.dispose && composer.dispose(); } catch {} },
  };
}
