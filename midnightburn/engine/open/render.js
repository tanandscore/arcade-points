// Midnight Burn — the 3D view of the city: streams the world in chunks around the car, draws the cars, traffic, markers, weather and the camera.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createHeroCar, makeEnvMap } from "../cars";
import { makeBlobShadow, makeGradePass, makeBeamMaterial } from "../fx";
import { rivalSpec } from "../drivers";
import { DEFAULT_SPEC, specOf } from "../cars";
import { CH, NCH } from "./world";
import { W, DISTRICTS, LAKES, AIRPORTS, districtDens } from "./geo";
import { createCrowd } from "./crowd";
import { createFestival, festivalOn, FEST_NAMES } from "./festival";
import { IS_TOKYO } from "./mapId";
import { sakuraAvenues } from "./maps/sakuraAvenue";
import { buildChunk, buildChunkSteps, setChunkDeadline, disposeGroup, C } from "./chunks3d";
import { buildLandmarks } from "./landmarks3d";
import { makeAirliner } from "./aircraft";
import { buildVehicleGeo } from "./vehicles3d";
import { createCockpit } from "./cockpit";
import { glowTexture, ringTexture, beamTexture, seaTexture, labelSprite } from "./textures";
import { vegMaterials, setWindTime } from "./vegetation";
import { createTrainKit, SPEC } from "./trains";
import { graffitiAtlas } from "./graffiti";
import { TOD, todByName, paintSky, cycleAt, blendTod, TOD_START } from "./tod";
import { setTextureClean, concreteTexture, gravelTexture, facadeSet, bandSet, adAtlas, bladeAtlas, boardAtlas, paveSet, groundDetail, cloudTexture, roadSet, asphaltDetail, leafTexture, frondTexture } from "./textures2";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PAL = { sky: 0x03030c, fog: 0x0a0a1c, neonA: 0xff2d95, neonB: 0x2de2ff, glass: 0xffd27a };
const RADIUS_MAX = 3; // chunks loaded around the car at most (the quality steps may lower it)

const GLOW_VS = `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 140.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const GLOW_FS = `uniform sampler2D map; uniform float fogNear; uniform float fogFar; uniform float uGain; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * 1.6 * uGain, t.a); }`;
const PART_VS = `attribute float size; attribute float alpha; attribute vec3 pcolor; varying float vA; varying vec3 vC; void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 260.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PART_FS = `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`;

export function createCityView(mount, G, opts = {}) {
  let RADIUS = RADIUS_MAX;
  const world = G.world, city = world.city;
  const width = mount.clientWidth || 960, height = mount.clientHeight || 540;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  // ---- picture quality (Upgrade 25) ----------------------------------------------------------------------------------------------------------------------
  // AUTO (the default) starts at a step chosen from the graphics card and then steers by the frame rate: it drops a step the moment the game slows down and
  // carefully tries a richer one again after a smooth stretch. HD / QHD / 4K lock a true render size (for strong cards); SAVER locks the lightest look.
  // Each step sets: pixel ratio (pr) and a cap on the number of pixels (px, millions), edge smoothing (msaa / fxaa), glow size, colour-grade detail,
  // how often the moon shadows are redrawn (every n frames) and how big they are, how far the city is drawn (chunks), plants and people.
  const QL = [
    { name: "FEATHER",  pr: 0.6,  px: 0.8, msaa: 0, fxaa: 0, bloom: 0,    grade: 1,   sh: [512, 30],   rad: 2, veg: 0.35, crowd: 0.25 },
    { name: "LIGHT",    pr: 0.72, px: 1.0, msaa: 0, fxaa: 0, bloom: 0,    grade: 1,   sh: [768, 12],   rad: 2, veg: 0.5,  crowd: 0.4 },
    { name: "EASY",     pr: 0.8,  px: 1.3, msaa: 0, fxaa: 0, bloom: 0,    grade: 0.5, sh: [1024, 6],   rad: 2, veg: 0.6,  crowd: 0.5 },
    { name: "BALANCED", pr: 0.9,  px: 1.6, msaa: 0, fxaa: 1, bloom: 0.4,  grade: 0.5, sh: [1024, 3],   rad: 3, veg: 0.7,  crowd: 0.6 },
    { name: "GOOD",     pr: 1.0,  px: 2.1, msaa: 0, fxaa: 1, bloom: 0.5,  grade: 0.5, sh: [1024, 2],   rad: 3, veg: 0.85, crowd: 0.8 },
    { name: "HIGH",     pr: 1.0,  px: 2.6, msaa: 2, fxaa: 0, bloom: 0.5,  grade: 0,   sh: [1536, 2],   rad: 3, veg: 1,    crowd: 1 },
    { name: "VERY HIGH", pr: 1.25, px: 3.6, msaa: 2, fxaa: 0, bloom: 0.75, grade: 0,   sh: [1536, 1],   rad: 3, veg: 1,    crowd: 1 },
    { name: "ULTRA",    pr: 1.5,  px: 4.8, msaa: 4, fxaa: 0, bloom: 1,    grade: 0,   sh: [2048, 1],   rad: 3, veg: 1,    crowd: 1 },
  ];
  const QMAX = QL.length - 1;
  const RES_W = { hd: 1920, qhd: 2560, "4k": 3840 };
  let resMode = opts.res || "auto"; try { const s = localStorage.getItem("mb-res"); if (!opts.res && s && (s in RES_W || s === "auto" || s === "low")) resMode = s; } catch {}
  if (opts.lite) resMode = "low";
  // what graphics card is this? (integrated chips start lower; the frame-rate governor corrects any wrong guess within a few seconds)
  let gpuName = ""; try { const gl0 = renderer.getContext(), ext = gl0.getExtension("WEBGL_debug_renderer_info"); gpuName = String(ext ? gl0.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl0.getParameter(gl0.RENDERER)); } catch {}
  const guessLevel = () => {
    const s = gpuName.toLowerCase(); let L = 3;
    if (/swiftshader|llvmpipe|software|basic render|softpipe|lavapipe|microsoft basic/.test(s)) L = 0;
    else if (/geforce\s*(rtx|gtx\s*(16|20|30|40|10[6-9]|9[6-9]))|rtx|radeon\s*(rx\s*(5[5-9]|[6-9])|pro|vii)|apple m[2-9]|apple m1 (pro|max|ultra)|arc\s*[ab]\d/.test(s)) L = 6;
    else if (/apple m1|apple gpu|geforce\s*gtx|radeon\s*rx|quadro|geforce\s*gt\s*[1-9]\d\d\d?/.test(s)) L = 5;
    else if (/iris\s*xe|iris\(r\)\s*xe|iris\s*plus|xe graphics|vega|radeon\(tm\)\s*graphics|radeon\s*graphics|geforce\s*mx/.test(s)) L = 3;
    else if (/intel|uhd|hd graphics|mali|adreno|powervr|videocore|geforce\s*(gt\s*7|920|930|940)/.test(s)) L = 2;
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    if (cores <= 2 || mem <= 2) L = Math.min(L, 1); else if (cores <= 4 || mem <= 4) L = Math.min(L, 3);
    return L;
  };
  let level = guessLevel(); let savedOk = false;
  try { const sv = JSON.parse(localStorage.getItem("mb-q") || "null"); if (sv && sv.r === gpuName && sv.l >= 0 && sv.l <= QMAX) { level = sv.l; savedOk = true; } } catch {}
  if (opts.lite) level = 1;
  const fixedRes = () => resMode in RES_W;
  const govOn = () => resMode === "auto" && !opts.lite && !window.__mbFixedPR;
  const effLevel = () => (fixedRes() ? (resMode === "4k" ? 6 : 7) : resMode === "low" ? 1 : level);
  const prFor = (L) => {
    const cw = mount.clientWidth || width, ch = mount.clientHeight || height, dpr = Math.max(1, window.devicePixelRatio || 1);
    if (fixedRes()) return Math.min(3.2, 8192 / Math.max(cw, 1), Math.max(1, RES_W[resMode] / Math.max(cw, 1)));
    const q = QL[L]; return Math.max(0.45, Math.min(q.pr, dpr * (L >= 7 ? 1.5 : L >= 6 ? 1.25 : 1), Math.sqrt((q.px * 1e6) / Math.max(1, cw * ch)), 8192 / Math.max(cw, 1)));
  };
  let pr = prFor(effLevel());
  renderer.setPixelRatio(pr); renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  mount.appendChild(renderer.domElement); renderer.domElement.style.display = "block";

  // time of day: the hours pass by themselves — sunset, then dusk, then night, then the glow slowly returns (the timetable is TOD_CYCLE in tod.js).
  // The player cannot change it. opts.tod pins a single look and is used only by the intro film and the test pages.
  let todAuto = !(opts.tod && TOD[opts.tod]), todClock = TOD_START, todPhase = "SUNSET";
  const todMix = (c) => blendTod(TOD[c.a], TOD[c.b], c.k);
  let T = todAuto ? todMix(cycleAt(TOD_START)) : todByName(opts.tod);
  let todName = T.name, envStage = T.name;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.fog);
  scene.fog = new THREE.Fog(PAL.fog, 120, 980);
  const camera = new THREE.PerspectiveCamera(64, width / height, 0.12, 4200);
  const ambient = new THREE.AmbientLight(0x7e84b0, 1.45), hemi = new THREE.HemisphereLight(0x7080e0, 0x30203a, 0.9), moon = new THREE.DirectionalLight(0x8fa0ff, 0.5);
  moon.position.set(-200, 300, 120); scene.add(ambient, hemi, moon, moon.target);
  // moonlight shadows follow the player: buildings, lamp posts, trees and cars all drop crisp shadows on the road
  const SHADOWS = !opts.lite;
  if (SHADOWS) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; moon.castShadow = true; moon.shadow.mapSize.set(QL[effLevel()].sh[0], QL[effLevel()].sh[0]);
    const sc = moon.shadow.camera; sc.left = -100; sc.right = 100; sc.top = 100; sc.bottom = -100; sc.near = 20; sc.far = 800; moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.4;
    moon.intensity = 1.5; ambient.intensity = 1.05; hemi.intensity = 0.8;
  }

  const glowTex = glowTexture(), ringTex = ringTexture(), beamTex = beamTexture(), blobTex = makeBlobShadow();
  let envMap = null; try { envMap = makeEnvMap(renderer, { ...PAL, tod: T.env }); } catch { envMap = null; }

  // ---- materials ---------------------------------------------------------------------------------------------------------------------------------
  setTextureClean(world.era === "2046"); // the 2046 city is scrubbed: far less grime, patching and staining on the pavements and tarmac
  const nResV = opts.lite ? 1 : 3, nOffV = opts.lite ? 1 : 2; // several wall designs per kind so blocks do not repeat; the light version keeps one and skips the relief maps
  const texResA = Array.from({ length: nResV }, (_, i) => facadeSet("res", 5, i, !opts.lite)), texOffA = Array.from({ length: nOffV }, (_, i) => facadeSet("office", 5, i, !opts.lite)), texInd = facadeSet("ind"), road = roadSet();
  const bands = { shops0: bandSet("shops", 9), shops1: bandSet("shops", 14), shops2: bandSet("shops", 23), shops3: bandSet("shops", 31), shops4: bandSet("shops", 47), lobby: bandSet("lobby"), dock: bandSet("dock") };
  const cementTex = concreteTexture(), gravelTex = gravelTexture(), leafTex = leafTexture(), frondTex = frondTexture(), adTex = adAtlas(), bladeTex = bladeAtlas(), boardTex = boardAtlas(), paveS = paveSet(), paveTex = paveS.map, grafTex = graffitiAtlas(), groundTex = groundDetail();
  const facadeMat = (T, glass) => new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.nm || null, normalScale: new THREE.Vector2(0.95, 0.95), emissiveMap: T.em, emissive: 0xffffff, emissiveIntensity: 0.62, vertexColors: true, roughness: 1, metalness: 1, roughnessMap: T.rm, metalnessMap: T.rm, envMap, envMapIntensity: glass ? 1.5 : 0.7 });
  const bandMat = (T) => new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.em, emissive: 0xffffff, emissiveIntensity: 0.85, vertexColors: true, roughness: 1, metalness: 1, roughnessMap: T.rm, metalnessMap: T.rm, envMap, envMapIntensity: 0.8 });
  const mats = {
    terrain: new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 1, metalness: 0 }),
    road: new THREE.MeshStandardMaterial({ map: road.map, roughnessMap: road.rm, vertexColors: true, roughness: 0.82, metalness: 0.1, envMap, envMapIntensity: 0.9 }),
    decal: new THREE.MeshStandardMaterial({ map: road.map, roughnessMap: road.rm, vertexColors: true, roughness: 0.82, metalness: 0.1, envMap, envMapIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    walk: new THREE.MeshStandardMaterial({ map: paveTex, bumpMap: paveS.bump, bumpScale: 1.6, vertexColors: true, roughness: 0.9, metalness: 0.02 }),
    concrete: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.12, envMap, envMapIntensity: 0.35 }),
    signs: new THREE.MeshStandardMaterial({ map: boardTex, vertexColors: true, roughness: 0.5, metalness: 0.2, emissiveMap: boardTex, emissive: 0xffffff, emissiveIntensity: 0.55 }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    ao: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), // soft dark contact shadow round the foot of every building (Upgrade 23)
    leaf: new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 }),
    frond: new THREE.MeshStandardMaterial({ map: frondTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }),
    ad: new THREE.MeshBasicMaterial({ map: adTex, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
    blade: new THREE.MeshBasicMaterial({ map: bladeTex, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
    cement: new THREE.MeshStandardMaterial({ map: cementTex, vertexColors: true, roughness: 0.93, metalness: 0 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelTex, vertexColors: true, roughness: 1, metalness: 0 }),
    facade: Object.assign({}, ...texResA.map((t, i) => ({ ["res" + i]: facadeMat(t, false) })), ...texOffA.map((t, i) => ({ ["office" + i]: facadeMat(t, true) })), { ind: facadeMat(texInd, false) }),
    band: { shops0: bandMat(bands.shops0), shops1: bandMat(bands.shops1), shops2: bandMat(bands.shops2), shops3: bandMat(bands.shops3), shops4: bandMat(bands.shops4), lobby: bandMat(bands.lobby), dock: bandMat(bands.dock) },
    graf: new THREE.MeshStandardMaterial({ map: grafTex, emissiveMap: grafTex, emissive: 0xffffff, emissiveIntensity: 0.05, vertexColors: true, transparent: true, alphaTest: 0.03, depthWrite: false, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    pool: new THREE.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }),
    glowPts: new THREE.ShaderMaterial({ uniforms: { map: { value: glowTex }, fogNear: { value: 0 }, fogFar: { value: 0 }, uGain: { value: 1 } }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  mats.pool.color = new THREE.Color(1, 1, 1);
  { const vm = vegMaterials(); mats.foliage = vm.foliage; mats.cover = vm.cover; mats.bark = vm.bark; } // painted trees, bushes, grass and rocks
  if (opts.lite) world.vegQuality = 0.5;

  // ---- sky, stars, moon, the distant glow of the city ------------------------------------------------------------------------------------
  {
    const geo = new THREE.SphereGeometry(3800, 56, 28); paintSky(geo, T);
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -10; dome.name = "sky"; scene.add(dome);
    const n = 700, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.random() * 0.95 + 0.14, r = 3500; sp[i * 3] = Math.cos(th) * Math.cos(ph) * r; sp[i * 3 + 1] = Math.sin(ph) * r * 0.9; sp[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(Object.assign(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })), { name: "stars" }));
    const moonM = new THREE.Mesh(new THREE.CircleGeometry(120, 28), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false })); moonM.position.set(-1800, 1400, -2500); moonM.lookAt(0, 0, 0); moonM.name = "moon"; scene.add(moonM);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x8fa0ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.copy(moonM.position).multiplyScalar(0.99); halo.lookAt(0, 0, 0); halo.name = "halo"; scene.add(halo);
    // moonlit clouds drifting slowly
    const cloudT = cloudTexture(); cloudT.repeat.set(1, 1);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(3600, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.5, side: THREE.BackSide, fog: false, depthWrite: false, color: 0x9fb0e0 })); cl.renderOrder = -9; cl.name = "clouds"; scene.add(cl);
    // light haze above every busy district, so the city glows on the horizon
    const hg = new THREE.Group(); hg.name = "haze";
    for (const d of DISTRICTS) { if (d.style === "forest") continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(d.r * 3.4, d.r * 1.5), new THREE.MeshBasicMaterial({ map: glowTex, color: d.style === "tower" || d.style === "glass" ? 0x6f8cff : 0xff9a52, transparent: true, opacity: 0.16 * d.dens, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(d.x, 95, d.z); m.rotation.y = 0; m.userData.bill = true; hg.add(m); }
    scene.add(hg);
  }
  // ---- the sea ------------------------------------------------------------------------------------------------------------------------------------------
  const seaTex = seaTexture();
  // ---- wet-road reflections: the scene is drawn again from a camera mirrored in the road, at half size, and the tarmac shows it where it is shiny (rain) ----
  let reflMode = "off"; try { reflMode = localStorage.getItem("mb-refl") === "on" ? "on" : "off"; } catch {}
  const asph = asphaltDetail(), asphTex = asph.map; const reflU = { tRefl: { value: null }, uReflM: { value: new THREE.Matrix4() }, uReflK: { value: 0 }, tAsph: { value: asphTex }, tAsphN: { value: asph.nrm }, uAsphK: { value: 1 }, uWetK: { value: 0 } }; const reflDummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); reflDummy.needsUpdate = true; reflU.tRefl.value = reflDummy;
  let reflRT = null; const reflCam = new THREE.PerspectiveCamera(); const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  // ---- tarmac that holds up close: a world-space grit texture (sharp however wide the road is), patchy repairs, shine that varies, puddles in rain ----
  const ASPH_PARS = `
    vec3 mbAsphA, mbAsphB;
    vec3 mbPerturb(vec3 sp, vec3 n, vec2 dH, float fd) {
      vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1) * fd;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2); return normalize(abs(det) * n - grad);
    }`;
  const ASPH_COLOR = `
    mbAsphA = texture2D(tAsph, vWP.xz * 0.5555).rgb;           // fine grit, repeats every 1.8 m
    mbAsphB = texture2D(tAsph, vWP.xz * 0.0435 + 0.37).rgb;    // broad blotches, repeats every 23 m
    { float grit = mbAsphA.r, blot = mbAsphB.g; float fade = 1.0 - smoothstep(60.0, 220.0, length(vViewPosition)) * 0.6;
      float tone = mix(0.84, 1.16, grit) * mix(0.82, 1.2, blot); diffuseColor.rgb *= mix(1.0, tone, fade);
      diffuseColor.rgb += vec3(0.05, 0.047, 0.043) * smoothstep(0.55, 1.0, mbAsphA.b) * fade; }`;
  const ASPH_ROUGH = `
    { float blot = mbAsphB.g; roughnessFactor = clamp(roughnessFactor * mix(0.72, 1.3, blot), 0.04, 1.0);
      float pud = smoothstep(0.56, 0.7, blot) * uWetK; roughnessFactor = mix(roughnessFactor, 0.03, pud); roughnessFactor = mix(roughnessFactor, min(1.0, roughnessFactor + 0.2), mbAsphA.b * 0.5 * (1.0 - uWetK)); }`;
  const ASPH_NORMAL = `
    { float near = 1.0 - smoothstep(40.0, 150.0, length(vViewPosition)); float pudl = smoothstep(0.56, 0.7, mbAsphB.g) * uWetK;
      vec3 nm = texture2D(tAsphN, vWP.xz * 0.5555).xyz * 2.0 - 1.0; vec3 nw = inverseTransformDirection(normal, viewMatrix);
      nw = normalize(nw + vec3(nm.x, 0.0, nm.y) * uAsphK * 1.2 * near * (1.0 - pudl)); normal = normalize(transformDirection(nw, viewMatrix)); }`;
  const injectRefl = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, reflU);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec4 vRefl; varying vec3 vWP; uniform mat4 uReflM;").replace("#include <begin_vertex>", "#include <begin_vertex>\n vRefl = uReflM * modelMatrix * vec4(transformed, 1.0); vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec4 vRefl; varying vec3 vWP; uniform sampler2D tRefl; uniform float uReflK; uniform sampler2D tAsph; uniform sampler2D tAsphN; uniform float uAsphK; uniform float uWetK;\n" + ASPH_PARS)
        .replace("#include <map_fragment>", "#include <map_fragment>\n" + ASPH_COLOR)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + ASPH_ROUGH)
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + ASPH_NORMAL).replace("#include <dithering_fragment>", "#include <dithering_fragment>\n if (uReflK > 0.0) { vec2 ruv = vRefl.xy / vRefl.w; vec3 rc = texture2D(tRefl, ruv).rgb; float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normalize(vNormal)), 0.0, 1.0), 2.0); float gl = clamp(1.0 - roughnessFactor * 1.15, 0.0, 1.0); gl_FragColor.rgb += rc * uReflK * gl * (0.3 + 0.7 * fres); }");
    };
    mat.customProgramCacheKey = () => "wetrefl"; mat.needsUpdate = true;
  };
  injectRefl(mats.road); injectRefl(mats.decal);
  function reflSize() { const c = renderer.domElement; return [Math.max(64, Math.floor(c.width * 0.5)), Math.max(64, Math.floor(c.height * 0.5))]; }
  function renderReflection(planeY, rainK) {
    const [rw, rh] = reflSize(); if (!reflRT || reflRT.width !== rw || reflRT.height !== rh) { reflRT && reflRT.dispose(); reflRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType }); }
    camera.updateMatrixWorld(); camera.getWorldPosition(_v1); _v2.set(0, 0, -1).applyQuaternion(camera.quaternion).add(_v1); _v3.set(0, 1, 0).applyQuaternion(camera.quaternion);
    reflCam.position.set(_v1.x, 2 * planeY - _v1.y, _v1.z); reflCam.up.set(_v3.x, -_v3.y, _v3.z); reflCam.lookAt(_v2.x, 2 * planeY - _v2.y, _v2.z);
    reflCam.fov = camera.fov; reflCam.aspect = camera.aspect; reflCam.near = camera.near; reflCam.far = 420; reflCam.updateProjectionMatrix(); reflCam.updateMatrixWorld();
    const tm = reflU.uReflM.value; tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(reflCam.projectionMatrix); tm.multiply(reflCam.matrixWorldInverse);
    const sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; const wasRain = rain.visible, wasFog = scene.fog.far; rain.visible = false; scene.fog.far = 420;
    reflU.tRefl.value = reflDummy; reflU.uReflK.value = 0;
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, reflCam); renderer.setRenderTarget(prev);
    renderer.shadowMap.autoUpdate = sh; rain.visible = wasRain; scene.fog.far = wasFog;
    reflU.tRefl.value = reflRT.texture; reflU.uReflK.value = Math.min(1.4, 0.2 + rainK * 1.3);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ color: 0x06202e, roughness: 0.16, metalness: 0.55, envMap, envMapIntensity: 1.2, bumpMap: seaTex, bumpScale: 0.6, transparent: false }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, -0.15, W / 2); scene.add(sea);
  {
    const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshBasicMaterial({ color: 0x05080f, fog: true })); far.name = "farground"; far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -1.2, W / 2); scene.add(far);
  }

  // ---- chunks (streamed) ----------------------------------------------------------------------------------------------------------------------------------
  const loaded = new Map(); const ck = (i, j) => i * 128 + j; const root = new THREE.Group(); scene.add(root);
  const texPack = { ...Object.fromEntries(texResA.map((t, i) => ["res" + i, t])), ...Object.fromEntries(texOffA.map((t, i) => ["office" + i, t])), ind: texInd, shops0: bands.shops0, shops1: bands.shops1, shops2: bands.shops2, shops3: bands.shops3, shops4: bands.shops4, lobby: bands.lobby, dock: bands.dock };
  function adopt(i, j, grp) { const k = ck(i, j); if (loaded.has(k)) { disposeGroup(grp); return false; } if (SHADOWS) grp.traverse((m) => { if (m.isMesh) { m.receiveShadow = true; m.castShadow = !(m.material === mats.road || m.material === mats.decal || m.material === mats.terrain || m.material === mats.pool || m.material === mats.neon || m.material === mats.walk || m.material === mats.cover || m.userData.cover); } }); root.add(grp); loaded.set(k, grp); applyTier(grp); return true; }
  function ensureChunk(i, j) { if (loaded.has(ck(i, j))) return false; return adopt(i, j, buildChunk(world, i, j, mats, texPack)); } // all at once: only for the loading screen
  // Upgrade 25: while driving, a new city block is built a few milliseconds per frame (never all at once), so the picture never freezes when you enter new streets.
  // The nearer the missing block is, the more time it gets, so fast driving still keeps ahead of the car.
  let job = null; const streamStat = { max: 0, built: 0, slices: 0, frameMs: 0 }; let streamPrev = 0;
  function streamStep(want, ci, cj) {
    if (!job) { for (const w of want) { if (!loaded.has(ck(w[1], w[2]))) { job = { i: w[1], j: w[2], it: buildChunkSteps(world, w[1], w[2], mats, texPack) }; break; } } if (!job) return; }
    const di = Math.max(Math.abs(job.i - ci), Math.abs(job.j - cj)); const prof = view.prof; const ms = prof ? -1e9 : di <= 1 ? 9 : di <= 2 ? 5 : 2.6;
    const t0 = performance.now(); setChunkDeadline(t0 + ms); const r = job.it.next(); const dt = performance.now() - t0; streamStat.frameMs += dt; streamStat.slices++; if (dt > streamStat.max) { streamStat.max = dt; streamStat.worstAt = [job.last || 0, r.done ? 99 : r.value, +dt.toFixed(1)]; } job.last = r.done ? 99 : r.value; if (prof) { const key = r.done ? 99 : r.value, o = prof[key] || (prof[key] = { n: 0, sum: 0, max: 0 }); o.n++; o.sum += dt; if (dt > o.max) o.max = dt; }
    if (r.done) { adopt(job.i, job.j, r.value); streamStat.built++; job = null; }
  }
  // plants: the rich version near the car, lighter ones further out (the three sets of instanced meshes are built together; only one is shown)
  const TIER_AT = { hi: [250, 230], mid: [590, 560] }; // [leave, enter] distances in metres, so a chunk on the line doesn't flicker
  function applyTier(grp) {
    const l = grp.userData.lod; if (!l) return; const dx = grp.userData.cx - camera.position.x, dz = grp.userData.cz - camera.position.z, d = Math.sqrt(dx * dx + dz * dz), cur = grp.userData.tier;
    const tier = d < (cur === "hi" ? TIER_AT.hi[0] : TIER_AT.hi[1]) ? "hi" : d < (cur === "mid" ? TIER_AT.mid[0] : TIER_AT.mid[1]) ? "mid" : "lo";
    if (cur !== tier || !grp.userData.tierSet) { grp.userData.tier = tier; grp.userData.tierSet = true; for (const nm of ["hi", "mid", "lo"]) for (const m of l[nm]) m.visible = nm === tier; }
  }
  function dropFar(ci, cj) { for (const [k, grp] of loaded) { const i = Math.floor(k / 128), j = k % 128; if (Math.abs(i - ci) > RADIUS + 1 || Math.abs(j - cj) > RADIUS + 1) { root.remove(grp); disposeGroup(grp); loaded.delete(k); if (world.plantsDrop) world.plantsDrop(i, j); } } }
  function wanted(ci, cj, fx, fz) { // nearest first, with a bias to what is ahead
    const out = []; for (let j = cj - RADIUS; j <= cj + RADIUS; j++) for (let i = ci - RADIUS; i <= ci + RADIUS; i++) { if (i < 0 || j < 0 || i >= NCH || j >= NCH) continue; if (loaded.has(ck(i, j))) continue; const dx = i - ci, dz = j - cj; out.push([dx * dx + dz * dz - (dx * fx + dz * fz) * 0.6, i, j]); }
    return out.sort((a, b) => a[0] - b[0]);
  }
  // if the graphics card is reset by the system (it happens on some laptops), the city blocks must be built again: their own copy of the numbers is dropped once the card has them
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
  renderer.domElement.addEventListener("webglcontextrestored", () => { for (const grp of loaded.values()) { root.remove(grp); disposeGroup(grp); } loaded.clear(); job = null; });
  const landmarkGroup = buildLandmarks(world, mats); scene.add(landmarkGroup);

  // ---- actors ----------------------------------------------------------------------------------------------------------------------------------------------------------
  const actors = new Map(); // key -> {mesh, kind}
  function makeHero(spec, lod = 1) {
    const m = createHeroCar(spec, { envMap, glowTex, poolTex: null, lod });
    const L = m.userData.arch ? m.userData.arch.L : 4.4;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.32, 2.7), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.045; m.add(blob);
    // a second, tighter and darker patch right under the body and tyres: it is what makes a car look planted on the road rather than hovering
    const core = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.0, 1.9), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    core.rotation.x = -Math.PI / 2; core.position.y = 0.047; m.add(core); scene.add(m); return m;
  }
  let playerMesh = null, playerKey = "";
  function refreshPlayer() {
    const c = G.career; const spec = specOf({ ...(c.spec || DEFAULT_SPEC), car: c.car });
    const key = JSON.stringify(spec); if (key === playerKey && playerMesh) return; playerKey = key;
    if (playerMesh) { scene.remove(playerMesh); playerMesh.userData.dispose && playerMesh.userData.dispose(); }
    playerMesh = makeHero(spec); playerMesh.userData.isPlayer = true; if (SHADOWS) playerMesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    // nitrous flames
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    playerMesh.userData.flames = [-0.55, 0.55].map((z) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 8), flameMat); f.rotation.z = Math.PI / 2; f.position.set((playerMesh.userData.tailX ?? -2.2) - 1.2, 0.55, z); f.visible = false; playerMesh.add(f); return f; });
  }
  const racerMeshes = new Map();
  function syncRacers() {
    const run = G.run; const keep = new Set();
    // the cars in a race, plus the street racers cruising the roads (Upgrade 38)
    const all = [...(run && run.racers ? run.racers : []), ...(G.racers || [])];
    all.forEach((r, i) => {
      keep.add(r.id); let m = racerMeshes.get(r.id);
      if (!m) { const spec = r.spec ? specOf(r.spec) : specOf(rivalSpec(i, (run && run.ev.level) || 1, r.car, r.color)); m = makeHero(spec, 0.5); racerMeshes.set(r.id, m); }
      m.visible = !r.out; place(m, r.v, 1 / 60);
      m.userData.tailMat.color.setHex(r.v.braking ? 0xff3b2b : 0xb81616);
    });
    for (const [id, m] of racerMeshes) if (!keep.has(id)) { scene.remove(m); m.userData.dispose && m.userData.dispose(); racerMeshes.delete(id); }
  }

  // crash feel (cosmetic): a big hit rocks or barrel-rolls the car, dents it a little, and a badly hurt car smokes
  const tum = { t: 0, dir: 1, full: false, dmg: 0, cd: 0 };
  function tumbleStep(P, dt) {
    tum.cd -= dt; const hit = G.cam.hit;
    if (hit > 7 && tum.cd <= 0 && tum.t <= 0 && cam.mode < 2) {
      tum.t = 0.001; tum.dir = Math.random() < 0.5 ? -1 : 1; tum.full = hit > 11 && P.speed > 25; tum.cd = 2.5; tum.dmg = Math.min(1, tum.dmg + 0.12 + hit * 0.015);
      for (let k = 0; k < 28; k++) emit(sparks, P.x, P.y + 0.6, P.z, (Math.random() - 0.5) * 18, 2 + Math.random() * 8, (Math.random() - 0.5) * 18, 0.8, 0.35 + Math.random() * 0.3, 0, 1, 0.7, 0.3, 1);
      for (let k = 0; k < 10; k++) emit(smoke, P.x, P.y + 0.5, P.z, (Math.random() - 0.5) * 8, 1 + Math.random() * 3, (Math.random() - 0.5) * 8, 1.6, 1.6, 4, 0.12, 0.12, 0.14, 0.7);
    }
    if (tum.t > 0) { tum.t += dt; const k = tum.t / (tum.full ? 1.3 : 0.6); if (k >= 1) tum.t = 0; else { playerMesh.rotateX(tum.dir * (tum.full ? k * Math.PI * 2 : Math.sin(k * Math.PI) * 0.5)); playerMesh.position.y += Math.sin(k * Math.PI) * (tum.full ? 1.6 : 0.3); } }
    playerMesh.scale.set(1 - 0.06 * tum.dmg, 1 - 0.02 * tum.dmg, 1 - 0.03 * tum.dmg); tum.dmg = Math.max(0, tum.dmg - dt * 0.004);
    if (tum.dmg > 0.35 && Math.random() < 0.5) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); emit(smoke, P.x + cs * 1.6, P.y + 0.7, P.z + sn * 1.6, -P.vx * 0.1, 1.4, -P.vz * 0.1, 1.2, 0.9, 3, 0.2, 0.2, 0.22, 0.45); }
    // headlight cones follow the car
    const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw), night = 1, vis = cam.mode < 2 && P.speed > -1; const op = Math.min(0.95, 0.4 + G.weather.rain * 0.5);
    hcMat.opacity = (0.025 + op * 0.04) * T.headK;
    hcones.forEach((m, i) => { m.visible = vis && T.headK > 0.02; const sd = i ? 0.7 : -0.7; m.position.set(P.x + cs * 2.1 - sn * sd, P.y + 0.75, P.z + sn * 2.1 + cs * sd); m.rotation.y = -P.yaw; });
  }
  function place(mesh, v, dt) {
    mesh.position.set(v.x, v.y + 0.1, v.z); mesh.rotation.y = -v.yaw; mesh.rotation.z = v.pitch || 0; mesh.rotation.x = clamp(v.roll || 0, -0.12, 0.12);
    const wl = mesh.userData.wheels; if (wl) for (const w of wl) { w.spin.rotation.z -= (v.fwd * dt) / (w.r || 0.37) * (w.dir || 1); if (w.front) w.pivot.rotation.y = -(v.steer || 0) * 0.42; }
    const sh = mesh.userData.shell; if (sh) { const pt = clamp((v.acc || 0) * 0.0011, -0.05, 0.035); sh.rotation.z += (pt - sh.rotation.z) * 0.12; }
  }
  // traffic: shared geometry per kind, one material per paint colour
  const vGeo = {}, vMat = new Map(), vFree = new Map(), vLive = new Map();
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), tailOn = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), tailOff = new THREE.MeshBasicMaterial({ color: 0x7a0c0c });
  // glossy lacquered paint: a clear coat over the colour, like a real car
  const paintMat = (col) => { let m = vMat.get(col); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: col, vertexColors: true, roughness: 0.3, metalness: 0.62, clearcoat: 1, clearcoatRoughness: 0.07, envMap, envMapIntensity: 1.15 }); vMat.set(col, m); } return m; };
  const glassTM = new THREE.MeshStandardMaterial({ color: 0x0b101a, roughness: 0.05, metalness: 0.4, envMap, envMapIntensity: 2.6 });
  const trimTM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35, envMap, envMapIntensity: 0.7 });
  const blobPlane = new THREE.PlaneGeometry(1, 1); const trafficBlobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const variantOf = (t) => (t.kind === "car" ? t.id % 3 : 0);
  function trafficMesh(t) {
    const vr = variantOf(t); const key = t.kind + t.color + vr; let list = vFree.get(key); let m = list && list.pop();
    if (!m) {
      const gk = t.kind + vr; const geo = vGeo[gk] || (vGeo[gk] = buildVehicleGeo(t.kind, vr));
      m = new THREE.Group(); m.rotation.order = "YXZ"; m.add(new THREE.Mesh(geo.body, paintMat(t.color)), new THREE.Mesh(geo.head, headMat));
      if (geo.glass) m.add(new THREE.Mesh(geo.glass, glassTM)); if (geo.trim) m.add(new THREE.Mesh(geo.trim, trimTM));
      const tl = new THREE.Mesh(geo.tail, tailOff); m.add(tl); m.userData = { tail: tl, key };
      { const SZ = { car: [4.9, 2.4], taxi: [4.9, 2.4], rick: [3.2, 1.9], bus: [11.6, 3.3], truck: [9, 3.2] }[t.kind] || [4.9, 2.4]; const bl = new THREE.Mesh(blobPlane, trafficBlobMat); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.04; bl.scale.set(SZ[0], SZ[1], 1); m.add(bl); const bc = new THREE.Mesh(blobPlane, trafficBlobMat); bc.rotation.x = -Math.PI / 2; bc.position.y = 0.043; bc.scale.set(SZ[0] * 0.78, SZ[1] * 0.72, 1); m.add(bc); }
      m.traverse((o) => { o.matrixAutoUpdate = true; }); scene.add(m);
    }
    m.visible = true; return m;
  }
  function syncTraffic() {
    const live = new Set();
    for (const t of G.traffic) {
      live.add(t.id); let m = vLive.get(t.id); if (!m) { m = trafficMesh(t); vLive.set(t.id, m); }
      m.position.set(t.x, t.y, t.z); m.rotation.y = -t.yaw; m.userData.tail.material = t.braking ? tailOn : tailOff;
      if (t.wreck > 0) m.rotation.z = Math.sin(t.id) * 0.12;
    }
    for (const [id, m] of vLive) if (!live.has(id)) { m.visible = false; let l = vFree.get(m.userData.key); if (!l) vFree.set(m.userData.key, (l = [])); l.push(m); vLive.delete(id); }
  }

  // ---- lights on the car --------------------------------------------------------------------------------------------------------------------------------------------
  const headL = new THREE.SpotLight(0xfff0d0, 140, 100, 0.5, 0.6, 1.3); scene.add(headL, headL.target);
  // visible headlight cones (light caught in the air / rain / haze)
  const hcGeo = new THREE.ConeGeometry(3.4, 40, 16, 1, true); hcGeo.translate(0, -20, 0); { const pa = hcGeo.attributes.position, ca = new Float32Array(pa.count * 3); for (let i = 0; i < pa.count; i++) { const f = Math.pow(1 + pa.getY(i) / 40, 1.6) * 0.9; ca[i * 3] = f; ca[i * 3 + 1] = f * 0.94; ca[i * 3 + 2] = f * 0.8; } hcGeo.setAttribute("color", new THREE.BufferAttribute(ca, 3)); } hcGeo.rotateZ(Math.PI / 2 - 0.05);
  const hcMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); const hcones = [-1, 1].map(() => { const m = new THREE.Mesh(hcGeo, hcMat); m.frustumCulled = false; scene.add(m); return m; });

  const underL = new THREE.PointLight(0x2de2ff, 6, 12, 1.6); scene.add(underL);

  // ---- markers --------------------------------------------------------------------------------------------------------------------------------------------------------------
  const markerGroup = new THREE.Group(); scene.add(markerGroup);
  const beamGeo = new THREE.CylinderGeometry(2.6, 2.6, 70, 16, 1, true); beamGeo.translate(0, 35, 0);
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  const TYPE_COL = { circuit: 0x2de2ff, sprint: 0x2de2ff, knockout: 0xb45cff, drag: 0xffb703, duel: 0xff2d95, drift: 0xff8a2d, delivery: 0x6bff6b, trap: 0xff4d4d };
  const TYPE_ICON = { circuit: "🏁", sprint: "🏁", knockout: "💀", drag: "⚡", duel: "👑", drift: "🌀", delivery: "📦", trap: "📷" };
  const markers = [];
  const stdBeam = (col, op) => new THREE.MeshBasicMaterial({ map: beamTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  function mkMarker(o) { // o: {x,z,y,col,label,sub,icon,tall}
    const g = new THREE.Group(); g.position.set(o.x, o.y + 0.1, o.z);
    const beam = new THREE.Mesh(beamGeo, stdBeam(o.col, o.beam ?? 0.5)); beam.scale.set(o.tall ? 1.2 : 1, o.tall ? 1.4 : 1, o.tall ? 1.2 : 1); g.add(beam);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, color: o.col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); ring.scale.set(o.ring || 26, 1, o.ring || 26); ring.position.y = 0.2; g.add(ring);
    let label = null; if (o.label) { label = labelSprite(o.label, "#" + new THREE.Color(o.col).getHexString(), o.sub || "", o.icon || ""); label.position.y = (o.tall ? 58 : 44); g.add(label); }
    markerGroup.add(g); const mk = { g, o, beam, ring, label, baseBeam: o.beam ?? 0.5 }; markers.push(mk); return mk;
  }
  const mkEvent = new Map(), mkShop = new Map(), mkSight = new Map(), mkStash = [], mkTrap = [];
  for (const ev of G.events) {
    if (ev.type === "trap") continue;
    if (ev.type === "drift") { const mk = mkMarker({ x: ev.x, z: ev.z, y: ev.sy ?? G.city.groundH(ev.x, ev.z), col: TYPE_COL.drift, label: ev.name, sub: "DRIFT ZONE", icon: TYPE_ICON.drift, ring: 30 }); mk.ev = ev; mkEvent.set(ev.id, mk); }
    else { const y = ev.sy ?? 0; const mk = mkMarker({ x: ev.sx, z: ev.sz, y, col: TYPE_COL[ev.type] || 0x2de2ff, label: ev.name, sub: ev.type.toUpperCase() + (ev.level > 1 ? "  ·  LV " + ev.level : ""), icon: TYPE_ICON[ev.type] }); mk.ev = ev; mkEvent.set(ev.id, mk); }
  }
  for (const sh of G.content.shops) { const mk = mkMarker({ x: sh.x, z: sh.z, y: sh.y, col: 0xffb703, label: sh.name, sub: "SHOP", icon: sh.icon, tall: true, ring: 30, beam: 0.55 }); mk.shop = sh; mkShop.set(sh.id, mk); }
  for (const s of G.content.sights) { const mk = mkMarker({ x: s.x, z: s.z, y: s.y, col: 0x9fd4ff, label: "", beam: 0.28, ring: 40 }); mk.sight = s; mkSight.set(s.id, mk); }
  // traps: a gantry across the road with a camera on it
  for (const ev of G.events) if (ev.type === "trap") {
    const g = new THREE.Group(); g.position.set(ev.x, ev.y ?? 0, ev.z); g.rotation.y = -ev.yaw; const m = new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.6, metalness: 0.4 });
    for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), m); p.position.set(0, 3.5, sz * 11); g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 23), m); beam.position.y = 7; g.add(beam);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x15151a })); cam.position.set(0, 6.2, 0); g.add(cam);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); lamp.position.set(0.6, 6.2, 0.4); g.add(lamp);
    const sign = labelSprite(ev.name, "#ff4d4d", "SPEED CAMERA  ·  " + ev.goals[0] + " km/h+", "📷"); sign.position.set(0, 12, 0); sign.scale.multiplyScalar(0.8); g.add(sign); markerGroup.add(g); mkTrap.push({ g, ev, lamp, sign, s0: { x: sign.scale.x, y: sign.scale.y } });
  }
  // cash stashes: a spinning gold diamond
  const stashGeo = new THREE.OctahedronGeometry(1, 0), stashMat = new THREE.MeshBasicMaterial({ color: 0xffd23a }), stashBig = new THREE.MeshBasicMaterial({ color: 0x6bff9a });
  for (const s of G.content.stashes) { const mesh = new THREE.Mesh(stashGeo, s.big ? stashBig : stashMat); mesh.scale.set(s.big ? 1.1 : 0.8, s.big ? 1.6 : 1.2, s.big ? 1.1 : 0.8); mesh.position.set(s.x, s.y + 1.6, s.z); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: s.big ? 0x6bff9a : 0xffd23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(9, 9, 1); mesh.add(gl); gl.scale.set(9 / mesh.scale.x, 9 / mesh.scale.y, 1); markerGroup.add(mesh); mkStash.push({ mesh, s }); }
  // ---- hidden garages (Upgrade 38) ---------------------------------------------------------------------------------------------------------------------------------
  // A small windowless workshop beside a street with a shuttered door. Until the driver finds it the sign is dead and there is no marker; once found the
  // neon comes on, light spills from under the door and it gets a beam, a name and a place on the map like any other workshop.
  const garageList = [];
  if ((G.content.garages || []).length) {
    const cvs = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const shutter = (() => { const c = cvs(128, 128), g = c.getContext("2d"); g.fillStyle = "#2b2d35"; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 8) { g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, y, 128, 2); g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(0, y + 2, 128, 1); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${90 + (i * 37) % 60},${50 + (i * 23) % 30},30,0.18)`; g.fillRect((i * 53) % 128, (i * 29) % 128, 3 + (i % 5), 18 + (i % 4) * 10); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const wall = (() => { const c = cvs(128, 128), g = c.getContext("2d"); g.fillStyle = "#4a4c55"; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 260; i++) { const v = 52 + (i * 31) % 40; g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`; g.fillRect((i * 47) % 128, (i * 71) % 128, 2 + (i % 6), 2 + (i % 4)); } g.fillStyle = "rgba(10,10,12,0.35)"; for (let k = 0; k < 6; k++) g.fillRect((k * 23 + 9) % 128, 0, 2, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const bodyMat = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.95, metalness: 0.05 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x23242b, roughness: 0.95 });
    const doorMat = new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.55, metalness: 0.55 });
    const frameDim = new THREE.MeshBasicMaterial({ color: 0x2a2440, toneMapped: false }), frameLit = new THREE.MeshBasicMaterial({ color: 0xb45cff, toneMapped: false });
    const gz = G.content.garages, GS = { hx: 3.5, hz: 4.5, h: 3.6 };
    const bodyG = new THREE.BoxGeometry(GS.hx * 2, GS.h + 1.2, GS.hz * 2); bodyG.translate(0, (GS.h - 1.2) / 2, 0);
    const roofG = new THREE.BoxGeometry(GS.hx * 2 + 0.5, 0.28, GS.hz * 2 + 0.5); roofG.translate(0, GS.h + 0.14, 0);
    const doorG = new THREE.PlaneGeometry(5.2, 2.9); doorG.rotateY(Math.PI / 2); doorG.translate(GS.hx + 0.03, 1.45, 0);
    const frameG = (() => { const parts = [[0.14, 3.05, 0, 0, 5.46], [0.14, 0.14, 0, 1.5, 0]]; const geos = []; for (const sz of [-1, 1]) { const g = new THREE.BoxGeometry(0.1, 3.05, 0.14); g.translate(GS.hx + 0.06, 1.5, sz * 2.7); geos.push(g); } const top = new THREE.BoxGeometry(0.1, 0.14, 5.54); top.translate(GS.hx + 0.06, 3.05, 0); geos.push(top); const out = new THREE.BufferGeometry(); const pos = [], idx = []; let off = 0; for (const g of geos) { const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); for (const i of g.index.array) idx.push(i + off); off += pa.count; } out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out; })();
    const signG = new THREE.PlaneGeometry(5.0, 0.8); signG.rotateY(Math.PI / 2); signG.translate(GS.hx + 0.05, GS.h - 0.42, 0);
    const signTex = (name) => { const c = cvs(512, 80), g = c.getContext("2d"); g.fillStyle = "#08080c"; g.fillRect(0, 0, 512, 80); g.font = "italic bold 40px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e6ccff"; g.shadowColor = "#b45cff"; g.shadowBlur = 14; g.fillText(name.toUpperCase().slice(0, 22), 256, 42); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const spillG = new THREE.PlaneGeometry(8, 7); spillG.rotateX(-Math.PI / 2);
    for (const gr of gz) {
      const grp = new THREE.Group(); grp.position.set(gr.bx, gr.by, gr.bz); grp.rotation.y = -gr.yaw;
      const body = new THREE.Mesh(bodyG, bodyMat), roof = new THREE.Mesh(roofG, roofMat), door = new THREE.Mesh(doorG, doorMat), frame = new THREE.Mesh(frameG, frameDim);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex(gr.name), color: 0x30303c, toneMapped: false }); const sign = new THREE.Mesh(signG, signMat);
      const spill = new THREE.Mesh(spillG, new THREE.MeshBasicMaterial({ map: glowTex, color: 0xb45cff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })); spill.position.set(GS.hx + 3.6, 0.15, 0);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xb45cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); lamp.scale.set(7, 3.4, 1); lamp.position.set(GS.hx + 0.8, GS.h - 0.5, 0);
      for (const m of [body, roof, door, frame, sign, spill, lamp]) { m.matrixAutoUpdate = false; m.updateMatrix(); grp.add(m); }
      grp.matrixAutoUpdate = true; grp.visible = false; scene.add(grp);
      garageList.push({ gr, grp, frame, frameLit, signMat, spill, lamp, lit: false, mk: null });
    }
  }
  function syncGarages(P) {
    if (!garageList.length) return;
    const found = new Set(G.career.garages || []);
    for (const o of garageList) {
      const gr = o.gr; const d = Math.hypot(gr.bx - P.x, gr.bz - P.z); const near = d < 440; o.grp.visible = near;
      const isFound = found.has(gr.id);
      if (isFound && !o.lit) { o.lit = true; o.frame.material = o.frameLit; o.signMat.color.setHex(0xffffff); o.spill.material.opacity = 0.5; o.lamp.material.opacity = 0.7; }
      if (isFound && !o.mk) { o.mk = mkMarker({ x: gr.x, z: gr.z, y: gr.y, col: 0xb45cff, label: gr.name, sub: "HIDDEN GARAGE", icon: gr.icon, tall: true, ring: 30, beam: 0.55 }); o.mk.shop = gr; }
      if (o.lit && near) { const k = 0.5 + 0.12 * Math.sin(clock * 2.2 + gr.bx); o.spill.material.opacity = k; o.lamp.material.opacity = 0.55 + 0.25 * Math.sin(clock * 3 + gr.bz); }
    }
  }
  // drift rings
  const driftRings = new Map();
  for (const ev of G.events) if (ev.type === "drift") {
    const N = 96, pos = [], idx = []; for (let k = 0; k <= N; k++) { const a = (k / N) * Math.PI * 2; const x = ev.x + Math.cos(a) * ev.radius, z = ev.z + Math.sin(a) * ev.radius; const y = G.city.groundH(x, z); pos.push(x, y + 0.5, z, x, y + 9, z); if (k < N) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const gm = new THREE.BufferGeometry(); gm.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); gm.setIndex(idx);
    const mesh = new THREE.Mesh(gm, new THREE.MeshBasicMaterial({ color: 0xff8a2d, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); mesh.visible = false; scene.add(mesh); driftRings.set(ev.id, mesh);
  }
  // race gates and the route ribbon
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x2de2ff }), gateMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gateGroup = new THREE.Group(); scene.add(gateGroup); const gates = [];
  for (let k = 0; k < 3; k++) { const g = new THREE.Group(); for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), k === 0 ? gateMat2 : gateMat); p.position.set(0, 4.5, sz * 9); g.add(p); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: k === 0 ? 0xffffff : 0x2de2ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(12, 12, 1); gl.position.set(0, 9.2, sz * 9); g.add(gl); } const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 18), k === 0 ? gateMat2 : gateMat); top.position.y = 9; g.add(top); g.visible = false; gateGroup.add(g); gates.push(g); }
  const RIB = 260; const ribPos = new Float32Array(RIB * 2 * 3), ribGeo = new THREE.BufferGeometry(); ribGeo.setAttribute("position", new THREE.BufferAttribute(ribPos, 3));
  { const idx = []; for (let k = 0; k < RIB - 1; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); ribGeo.setIndex(idx); }
  const ribbon = new THREE.Mesh(ribGeo, new THREE.MeshBasicMaterial({ color: 0x2de2ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true })); ribbon.frustumCulled = false; ribbon.visible = false; scene.add(ribbon);
  const wpBeam = new THREE.Mesh(beamGeo, stdBeam(0x2de2ff, 0.7)); wpBeam.visible = false; scene.add(wpBeam);
  // chevron boards for the corners (two flipped textures, three sprites reused)
  const chevTex = (() => { const mk = (flip) => { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d"); g.translate(64, 64); if (flip) g.scale(-1, 1); g.lineJoin = "miter"; const chevs = (col, w) => { g.strokeStyle = col; g.lineWidth = w; for (const dx of [-26, 6]) { g.beginPath(); g.moveTo(dx - 14, -40); g.lineTo(dx + 22, 0); g.lineTo(dx - 14, 40); g.stroke(); } }; chevs("rgba(30,14,0,0.85)", 27); g.shadowColor = "#ff9a1a"; g.shadowBlur = 14; chevs("#ffb52e", 15); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }; return { R: mk(false), L: mk(true) }; })();
  const chev = [0, 1, 2].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: chevTex.R, transparent: true, depthWrite: false, fog: false, toneMapped: false })); sp.scale.set(15, 15, 1); sp.visible = false; scene.add(sp); return sp; });

  // ---- weather and particles -------------------------------------------------------------------------------------------------------------------------------------------------------------
  const RN = 1800; const rpos = new Float32Array(RN * 6), rbase = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { rbase[i * 3] = (Math.random() - 0.5) * 120; rbase[i * 3 + 1] = Math.random() * 40; rbase[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0x9fb0d8, transparent: true, opacity: 0.0, fog: false })); rain.frustumCulled = false; scene.add(rain);
  function makePS(n, additive) {
    const g = new THREE.BufferGeometry(); const P = new Float32Array(n * 3), S = new Float32Array(n), A = new Float32Array(n), Cc = new Float32Array(n * 3);
    g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("size", new THREE.BufferAttribute(S, 1)); g.setAttribute("alpha", new THREE.BufferAttribute(A, 1)); g.setAttribute("pcolor", new THREE.BufferAttribute(Cc, 3));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { map: { value: glowTex } }, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; scene.add(m);
    return { n, P, S, A, C: Cc, V: new Float32Array(n * 3), L: new Float32Array(n), life0: new Float32Array(n), a0: new Float32Array(n), grow: new Float32Array(n), s0: new Float32Array(n), i: 0, g, m };
  }
  const smoke = makePS(260, false), sparks = makePS(160, true);
  // airborne embers / bokeh: warm specks that streak past the car like the sparks in the NFS stills
  const EMB_N = 260, embSeed = new Float32Array(EMB_N * 3), embPos = new Float32Array(EMB_N * 3); for (let i = 0; i < EMB_N * 3; i++) embSeed[i] = Math.random();
  const embGeo = new THREE.BufferGeometry(); embGeo.setAttribute("position", new THREE.BufferAttribute(embPos, 3));
  const embMat = new THREE.PointsMaterial({ color: 0xffa860, size: 3.2, sizeAttenuation: false, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const embers = new THREE.Points(embGeo, embMat); embers.frustumCulled = false; scene.add(embers);
  // Upgrade 34: cherry petals drifting down, only near the blossom avenues of Tokyo (a fixed handful of points that wrap round the car, like the embers; nothing is drawn anywhere else)
  const PET_N = 180, petSeed = new Float32Array(PET_N * 3), petPos = new Float32Array(PET_N * 3); for (let i = 0; i < PET_N * 3; i++) petSeed[i] = Math.random();
  const petGeo = new THREE.BufferGeometry(); petGeo.setAttribute("position", new THREE.BufferAttribute(petPos, 3));
  const petMat = new THREE.PointsMaterial({ color: 0xffdce6, size: 4.6, sizeAttenuation: false, map: glowTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const petals = new THREE.Points(petGeo, petMat); petals.frustumCulled = false; petals.visible = false; scene.add(petals);
  const sakAv = IS_TOKYO ? sakuraAvenues(city, world.landmarks) : [];

  function emit(ps, x, y, z, vx, vy, vz, life, size, grow, r, g, b, a) { const i = ps.i++ % ps.n; ps.P.set([x, y, z], i * 3); ps.V.set([vx, vy, vz], i * 3); ps.L[i] = life; ps.life0[i] = life; ps.a0[i] = a; ps.s0[i] = size; ps.grow[i] = grow; ps.S[i] = size; ps.A[i] = a; ps.C.set([r, g, b], i * 3); }
  function stepPS(ps, dt, drag, grav) {
    for (let i = 0; i < ps.n; i++) {
      if (ps.L[i] <= 0) { ps.A[i] = 0; continue; } ps.L[i] -= dt; const t = ps.L[i] / ps.life0[i];
      ps.V[i * 3] *= 1 - drag * dt; ps.V[i * 3 + 1] = ps.V[i * 3 + 1] * (1 - drag * dt) + grav * dt; ps.V[i * 3 + 2] *= 1 - drag * dt;
      ps.P[i * 3] += ps.V[i * 3] * dt; ps.P[i * 3 + 1] += ps.V[i * 3 + 1] * dt; ps.P[i * 3 + 2] += ps.V[i * 3 + 2] * dt; ps.S[i] = ps.s0[i] + ps.grow[i] * (1 - t); ps.A[i] = Math.max(0, t) * ps.a0[i];
    }
    ps.g.attributes.position.needsUpdate = ps.g.attributes.size.needsUpdate = ps.g.attributes.alpha.needsUpdate = ps.g.attributes.pcolor.needsUpdate = true;
  }

  // Most Wanted look (Upgrade 33.2): one small tweak of the existing colour grade per map, so it costs nothing extra to draw.
  // Mumbai: grimy, warm, a little desaturated, hard contrast. Tokyo: clean, crisp, cool neon with a touch of warmth.
  const _sunV = new THREE.Vector3();
  const MWG = IS_TOKYO ? { sat: 1.1, con: 1.08, vig: 0.06, teal: 1.0, warm: [1.04, 1.0, 0.94], warmK: 0.5, glare: 0.5 } : { sat: 0.86, con: 1.12, vig: 0.12, teal: 0.35, warm: [1.16, 1.02, 0.78], warmK: 1.0, glare: 1.0 };
  // ---- post-processing ------------------------------------------------------------------------------------------------------------------------------------------------------
  let composer = null, gradePass = null, bloom = null, fxaaPass = null;
  try {
    const q0 = QL[effLevel()];
    const rt = new THREE.WebGLRenderTarget(Math.floor(width * pr), Math.floor(height * pr), { type: THREE.HalfFloatType, samples: q0.msaa });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.72, 0.6, 0.7); composer.addPass(bloom);
    { const bs = bloom.setSize.bind(bloom); bloom.userData = { k: 1 }; bloom.setSize = (w, h) => bs(Math.max(32, w * bloom.userData.k), Math.max(32, h * bloom.userData.k)); } // the glow can be worked out at a fraction of the picture size
    gradePass = makeGradePass(); gradePass.uniforms.uRes.value.set(width * pr, height * pr); composer.addPass(gradePass); composer.addPass(new OutputPass());
    fxaaPass = new ShaderPass(FXAAShader); fxaaPass.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr)); composer.addPass(fxaaPass); // (switched on only in the steps without multisampling)
    composer.renderTarget1.samples = 0; // only the target the scene is drawn into needs multisampling; the grade passes write to a plain one
  } catch { composer = null; }
  // apply the picture-quality step to everything that depends on it (called at the start and whenever the governor, or the player, changes the step)
  let shAppliedSize = 0, shEvery = 1, shFrame = 0, fogK = 1, crowdRef = null;
  // Upgrade 37: the governor now tells apart a slow GRAPHICS CARD (lower the picture size and effects) from a slow PROCESSOR (too many objects to prepare each frame: lower the
  // draw distance, plants, people and shadow redraws instead). Before, a processor-bound laptop was pushed down to a blurry, half-size picture that did not make it any faster.
  // cpuCut is how much of that object detail has been given up (0 = none, 3 = most); it is independent of the picture step.
  let cpuCut = 0; const CUT = { veg: [1, 0.85, 0.65, 0.45], crowd: [1, 0.7, 0.5, 0.3], sh: [1, 2, 3, 5] };
  function applyLevel(L, force) {
    const fx = fixedRes(), q = QL[fx ? effLevel() : L]; const np = prFor(L);
    if (composer) {
      if (bloom) { bloom.enabled = q.bloom > 0; if (q.bloom > 0 && Math.abs(bloom.userData.k - q.bloom) > 0.01) { bloom.userData.k = q.bloom; } }
      if (gradePass) { gradePass.uniforms.uLite.value = opts.lite ? 1 : q.grade; gradePass.uniforms.uSharp.value = opts.lite || q.grade >= 1 ? 0 : (q.pr >= 1.25 ? 0.45 : q.pr >= 1 ? 0.6 : 0.8); } // sharpening: stronger where the picture is drawn smaller; off only in the two emergency steps
      if (fxaaPass) fxaaPass.enabled = !!q.fxaa;
      const sb = composer.readBuffer, ob = composer.writeBuffer; const want = q.fxaa ? 0 : q.msaa;
      if (sb.samples !== want || ob.samples !== 0 || force) { sb.samples = want; ob.samples = 0; sb.dispose(); ob.dispose(); }
    }
    if (Math.abs(np - pr) > 0.015 || force) applyPR(np); else if (composer && bloom) composer.setSize(mount.clientWidth || width, mount.clientHeight || height);
    const cc = opts.lite || fx ? 0 : cpuCut;
    if (SHADOWS) { shEvery = Math.max(1, q.sh[1]) * CUT.sh[cc]; if (q.sh[0] !== shAppliedSize) { shAppliedSize = q.sh[0]; moon.shadow.mapSize.set(q.sh[0], q.sh[0]); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } } renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; }
    world.vegQuality = opts.lite ? 0.5 : q.veg * CUT.veg[cc]; RADIUS = cc >= 2 ? Math.min(q.rad, 2) : q.rad; fogK = RADIUS >= 3 ? 1 : 0.7;
    if (crowdRef && crowdRef.setDensity) crowdRef.setDensity(q.crowd * CUT.crowd[cc], q.crowd * CUT.crowd[cc] >= 0.5);
    if (typeof dropFar === "function" && lastCi > -90) dropFar(lastCi, lastCj);
  }
  // ---- camera ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const cockpit = createCockpit(); scene.add(camera); camera.add(cockpit.group);
  const cam = { x: 0, y: 5, z: 0, ang: 0, init: false, mode: 0, shake: 0, fov: 64, look: 0 };
  let clock = 0, lastCi = -99, lastCj = -99, prevStamp = 0;

  function syncMarkers(P, dt) {
    const run = G.run, career = G.career; const px = P.x, pz = P.z;
    syncGarages(P);
    for (const mk of markers) {
      const o = mk.o; const d = Math.hypot(o.x - px, o.z - pz); const far = d > 1500; let vis = !far;
      if (mk.ev) { const ev = mk.ev; const done = career.done[ev.id]; const locked = !G.isUnlocked(ev); const active = run && run.ev === ev;
        vis = vis && !run; const col = locked ? 0xff3b3b : done ? (done.medal === "gold" ? 0xffd23a : 0x6bff6b) : (TYPE_COL[ev.type] || 0x2de2ff);
        if (mk.col !== col) { mk.col = col; mk.beam.material.color.setHex(col); mk.ring.material.color.setHex(col); }
        mk.baseBeam = locked ? 0.22 : 0.5; if (mk.label) mk.label.visible = d < 520 && !locked || d < 160; mk.ring.scale.setScalar((o.ring || 26) * (1 + 0.04 * Math.sin(clock * 3 + o.x)));
      } else if (mk.shop) { vis = vis && !run; if (mk.label) mk.label.visible = d < 700; mk.ring.scale.setScalar((o.ring || 30) * (1 + 0.04 * Math.sin(clock * 2.4))); }
      else if (mk.sight) { vis = vis && !career.sights.includes(mk.sight.id) && d < 900; }
      mk.g.visible = vis;
      if (vis) { const near = d < 45; if (mk.beam) mk.beam.material.opacity = mk.baseBeam * clamp((d - 14) / 46, 0, 1); mk.beam.visible = d > 15; if (mk.ring && mk.ring.material) { if (mk.ring0 == null) mk.ring0 = mk.ring.material.opacity; mk.ring.material.opacity = mk.ring0 * clamp((d - 28) / 90, 0.04, 1); } if (mk.label) { const dc = Math.hypot(o.x - camera.position.x, o.z - camera.position.z); const sc = clamp(dc / 160, 0.55, 3.2); mk.label.scale.set(26 * sc, 8.1 * sc, 1); if (dc < 38) mk.label.visible = false; } }
    }
    for (const ts of mkStash) { const got = career.stash.includes(ts.s.id); const d = Math.hypot(ts.s.x - px, ts.s.z - pz); ts.mesh.visible = !got && d < 420; if (ts.mesh.visible) { ts.mesh.rotation.y = clock * 2; ts.mesh.position.y = ts.s.y + 1.7 + Math.sin(clock * 2 + ts.s.x) * 0.25; } }
    for (const tp of mkTrap) { const d = Math.hypot(tp.ev.x - px, tp.ev.z - pz); tp.g.visible = d < 900; if (tp.g.visible) { const dc = Math.hypot(tp.ev.x - camera.position.x, tp.ev.z - camera.position.z); const k = clamp(dc / 160, 0.5, 2.6); tp.sign.scale.set(tp.s0.x * k * 0.8, tp.s0.y * k * 0.8, 1); tp.sign.visible = dc > 30 && dc < 420; } }
    for (const [id, mesh] of driftRings) { const ev = G.eventById[id]; const d = Math.hypot(ev.x - px, ev.z - pz); mesh.visible = (run ? run.ev === ev : d < 1400); mesh.material.opacity = run && run.ev === ev ? (run.inside ? 0.28 : 0.14) : 0.1; }
    // gates for the active race
    gateGroup.children.forEach((g) => (g.visible = false));
    if (run && run.route && run.state !== "done" && run.kind !== "drift" && run.kind !== "delivery" && run.kind !== "outrun") {
      const L = run.route.pts, gi = run.route.gates; for (let k = 0; k < 3; k++) { const gidx = run.gate + k; if (gidx >= gi.length) break; const p = L[gi[gidx]]; const q = L[Math.min(L.length - 1, gi[gidx] + 2)], p0 = L[Math.max(0, gi[gidx] - 2)]; const g = gates[k]; g.visible = true; g.position.set(p.x, p.y, p.z); g.rotation.y = -Math.atan2(q.z - p0.z, q.x - p0.x); const sc = k === 0 ? 1 : 0.8; g.scale.set(1, sc, sc); }
    } else if (run && run.kind === "delivery") { const L = run.route.pts, e = L[L.length - 1]; const g = gates[0]; g.visible = true; g.position.set(e.x, e.y, e.z); g.rotation.y = clock; }
    // route ribbon: the GPS line a few hundred metres ahead
    let line = null; if (G.nav && G.nav.line && G.nav.line.length > 1) line = G.nav.line;
    if (run && run.route && run.kind !== "drift") line = run.route.pts;
    ribbon.visible = false; wpBeam.visible = false;
    if (line && line.length > 1) {
      let best = 0, bd = 1e12; const step = line.length > 400 ? 3 : 1; for (let i = 0; i < line.length; i += step) { const d = (line[i].x - px) ** 2 + (line[i].z - pz) ** 2; if (d < bd) { bd = d; best = i; } }
      let n = 0; const from = Math.max(0, best - 2); for (let i = from; i < line.length - 1 && n < RIB; i++) {
        const a = line[i], b = line[i + 1]; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; const nx = -dz / l * 1.4, nz = dx / l * 1.4; const y = (a.y ?? P.y) + 0.35;
        ribPos[n * 6] = a.x + nx; ribPos[n * 6 + 1] = y; ribPos[n * 6 + 2] = a.z + nz; ribPos[n * 6 + 3] = a.x - nx; ribPos[n * 6 + 4] = y; ribPos[n * 6 + 5] = a.z - nz; n++;
        if (Math.hypot(a.x - px, a.z - pz) > 420) break;
      }
      if (n > 2) { for (let k = n; k < RIB; k++) { ribPos[k * 6] = ribPos[(n - 1) * 6]; ribPos[k * 6 + 1] = ribPos[(n - 1) * 6 + 1]; ribPos[k * 6 + 2] = ribPos[(n - 1) * 6 + 2]; ribPos[k * 6 + 3] = ribPos[(n - 1) * 6 + 3]; ribPos[k * 6 + 4] = ribPos[(n - 1) * 6 + 4]; ribPos[k * 6 + 5] = ribPos[(n - 1) * 6 + 5]; } ribGeo.attributes.position.needsUpdate = true; ribbon.visible = true; ribbon.material.opacity = 0.35 + 0.2 * Math.sin(clock * 4); }
    }
    // Most Wanted turn markers: glowing chevrons on the outside of the next sharp corner of the route
    chev.forEach((c) => (c.visible = false));
    if (line && line.length > 6) {
      let best2 = 0, bd2 = 1e12; const st2 = line.length > 400 ? 3 : 1; for (let i = 0; i < line.length; i += st2) { const d = (line[i].x - px) ** 2 + (line[i].z - pz) ** 2; if (d < bd2) { bd2 = d; best2 = i; } }
      let used = 0, travelled = 0;
      for (let i = best2 + 1; i < line.length - 3 && used < chev.length && travelled < 380; i += 2) {
        const a = line[i - 1], b = line[i], c2 = line[Math.min(line.length - 1, i + 3)]; travelled += Math.hypot(b.x - a.x, b.z - a.z) * 2;
        const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c2.z - b.z, c2.x - b.x); let dh = h2 - h1; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        if (Math.abs(dh) > 0.5) {
          const sp = chev[used++]; const nx = -Math.sin(h1) * Math.sign(dh), nz = Math.cos(h1) * Math.sign(dh);
          sp.position.set(b.x - nx * 7, (b.y ?? P.y) + 3.4, b.z - nz * 7); { const dd = Math.hypot(sp.position.x - px, sp.position.z - pz), k = clamp(dd / 14, 14, 34); sp.scale.set(k, k, 1); } sp.material.map = dh > 0 ? chevTex.R : chevTex.L; sp.material.opacity = clamp((travelled - 25) / 60, 0, 1) * 0.95; sp.visible = true;
          i += 10;
        }
      }
    }
    if (G.nav && G.nav.target && !run) { wpBeam.visible = true; wpBeam.position.set(G.nav.target.x, G.city.groundH(G.nav.target.x, G.nav.target.z), G.nav.target.z); wpBeam.scale.set(1.3, 2.4, 1.3); }
  }


  // ---- metro trains and the bullet train running on the viaducts, and station name boards -------------------------------------
  const trains = [], stationSigns = []; const trainKit = createTrainKit(envMap); mats.train = trainKit.mats;
  {
    const headM = new THREE.MeshBasicMaterial({ color: 0xfff4d8, toneMapped: false }), tailLampM = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
    const glowSpr = (c, sz) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(sz); return sp; };
    for (const L of city.metro || []) {
      const col = new THREE.Color(L.color); const fast = !!L.fast; const kind = fast ? "fast" : "metro", SP = SPEC[kind], tm = trainKit.get(kind);
      const geo = trainKit.geo(kind, fast ? 0x1c8fe0 : L.color); // shaped body + cab nose, with the line colour as a stripe
      const nCars = fast ? 8 : 6; const spacing = fast ? SP.CL + 0.6 : 18.4;
      const nTr = fast ? 3 : Math.max(3, Math.min(10, Math.round(L.len / 800)));
      const lampBox = new THREE.BoxGeometry(0.07, 0.2, 0.38);
      for (let t = 0; t < nTr; t++) {
        const g = new THREE.Group(); const cars = [];
        for (let k = 0; k < nCars; k++) {
          const c = new THREE.Group(); const motor = !fast && (k === 1 || k === nCars - 2);
          c.add(new THREE.Mesh(geo.body, tm.body), new THREE.Mesh(trainKit.det(kind, motor), tm.detail));
          if (k === 0 || k === nCars - 1) {
            const sgn = k === 0 ? 1 : -1; const nose = new THREE.Mesh(geo.nose, tm.nose); if (k === nCars - 1) nose.rotation.y = Math.PI; c.add(nose);
            const reach = SP.CL / 2 + (fast ? 8.1 : SP.Ln + 0.02), ly = SP.ybot + (fast ? 0.55 : 0.72), lz = fast ? 0.7 : 0.86;
            for (const side of [-1, 1]) { const lamp = new THREE.Mesh(lampBox, k === 0 ? headM : tailLampM); lamp.position.set(sgn * reach, ly, side * lz); c.add(lamp); }
            const gl = glowSpr(k === 0 ? 0xfff0c8 : 0xff3030, fast ? 24 : 15); gl.position.set(sgn * (reach + 0.5), ly, 0); c.add(gl);
          }
          g.add(c); cars.push(c);
        }
        g.visible = false; scene.add(g);
        // trains start spread along the line, half of them heading each way, each with its own speed
        const dir = L.loop ? 1 : t % 2 ? -1 : 1; const st0 = L.stations[Math.min(L.stations.length - 1, Math.floor(((t + 0.5) / nTr) * L.stations.length))];
        trains.push({ L, g, cars, spacing, fast, s: st0.s, dir, v: 0, vmax: fast ? 80 + (t % 2) * 6 : 21 + (t % 3) * 2.5, acc: fast ? 0.95 : 0.9, dec: fast ? 1.0 : 1.3, dwell: 2 + t * 1.5, next: L.loop ? (L.stations.indexOf(st0) + 1) % L.stations.length : Math.max(0, Math.min(L.stations.length - 1, L.stations.indexOf(st0) + dir)) });
      }
      for (const st of L.stations) stationSigns.push({ sp: null, st, L, col });
    }
  }
  // ---- airliners: every airport has a steady flow of arrivals and departures, flown from closed-form flight profiles --------------
  // arrival: 3-degree glide at 78 m/s, flare, touchdown, braking roll, turn-off; departure: hold, roll, rotate, climb. Two planes of each
  // kind per airport, 70 s apart on a 140 s cycle, so there is always something landing or taking off. A few high flyers cross the sky too.
  const planes = [], cruisers = [];
  {
    const AC = 0.0524; const sstep = (a0, b0, x) => { const t = Math.max(0, Math.min(1, (x - a0) / (b0 - a0))); return t * t * (3 - 2 * t); };
    const rwy = (a, r) => { const ca = Math.cos(a.rot), sa = Math.sin(a.rot); return { cx: a.x + r.x * ca - r.z * sa, cz: a.z + r.x * sa + r.z * ca, yaw: a.rot + r.ang }; };
    let li = 0;
    for (const a of AIRPORTS) {
      const gy0 = city.groundH(a.x, a.z); const ra = rwy(a, a.runways[0]), rd = rwy(a, a.runways[a.id === "nmia" ? 1 : 0]);
      for (const kind of ["arr", "dep"]) for (let j = 0; j < 2; j++) {
        const type = (a.id === "nmia" ? j === 0 : kind === "arr" && j === 1) ? "wide" : "narrow"; const g = makeAirliner(type, li++, envMap);
        g.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.fog = false; } }); g.visible = false; g.rotation.order = "YXZ"; scene.add(g);
        planes.push({ a, kind, g, rw: kind === "arr" ? ra : rd, gy: gy0 + 0.6 * g.userData.S.R + g.userData.S.gear - 0.1, off: (kind === "arr" ? 0 : 114) + j * 70 + (a.id === "nmia" ? 33 : 0), side: (j % 2 ? 1 : -1), idx: li });
      }
    }
    for (let k = 0; k < 6; k++) { const g = makeAirliner(k % 3 === 0 ? "wide" : "narrow", 3 + k, envMap); g.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.fog = false; } }); g.visible = false; g.rotation.order = "YXZ"; g.scale.setScalar(1.0); scene.add(g); const ang = (k / 6) * Math.PI + 0.3; cruisers.push({ g, ang, off: k * 41, alt: 2300 + (k % 3) * 400, sp: 170 + (k % 2) * 25, side: (k - 2.5) * 3200 }); }
    planes.step = (p, T) => {
      const per = 140, tau = (T + p.off) % per; let s = 0, lat = 0, alt = 0, pitch = 0, bank = 0, yo = 0, on = true, landing = false;
      if (p.kind === "arr") {
        if (tau >= 115) on = false;
        else if (tau < 70) { const glide = (70 - tau) * 78 * AC; s = -750 - (70 - tau) * 78; alt = glide * (glide < 25 ? 0.35 + 0.65 * glide / 25 : 1); pitch = 0.03 + (tau > 64 ? (tau - 64) / 6 * 0.07 : 0); landing = true; }
        else { const t2 = tau - 70, tb = 23.08; s = -750 + (t2 < tb ? 78 * t2 - 1.3 * t2 * t2 : 78 * tb - 1.3 * tb * tb + 18 * (t2 - tb)); pitch = 0.1 * Math.max(0, 1 - t2 / 2); const e = sstep(24, 44, t2); lat = p.side * e * 48; yo = p.side * e * 0.45; landing = true; }
      } else {
        if (tau >= 112) on = false;
        else if (tau < 6) { s = -1000; landing = true; }
        else { const t2 = tau - 6, t1 = 28.6, s1 = -1000 + 1.4 * t1 * t1; landing = true;
          if (t2 < t1) s = -1000 + 1.4 * t2 * t2; else { const d = t2 - t1; s = d < 20.8 ? s1 + 80 * d + 0.6 * d * d : s1 + 80 * 20.8 + 0.6 * 20.8 * 20.8 + 105 * (d - 20.8); pitch = 0.14 * sstep(0, 3.4, d); }
          const x = Math.max(0, t2 - 32); const vy = x < 3.1 ? 4.5 * x : 14; alt = Math.min(2200, x < 3.1 ? 2.25 * x * x : 21.6 + 14 * (x - 3.1)); if (x > 0) pitch = Math.atan2(vy, 95) + 0.07; if (alt > 120) { landing = false; lat = p.side * Math.max(0, s - 2400) * 0.12; yo = p.side * 0.12 * sstep(2400, 3200, s); bank = -p.side * 0.2 * sstep(2400, 2800, s) * (1 - sstep(4200, 5200, s)); } }
      }
      return { s, lat, alt, pitch, bank, yo, on, landing };
    };
  }
  function updatePlanes(dt) {
    const cx0 = camera.position.x, cz0 = camera.position.z, T = clock;
    for (const p of planes) {
      const r = planes.step(p, T); const R = p.rw; const co = Math.cos(R.yaw), si = Math.sin(R.yaw); const x = R.cx + co * r.s - si * r.lat, z = R.cz + si * r.s + co * r.lat; const y = p.gy + r.alt;
      p.g.visible = r.on && Math.hypot(x - cx0, z - cz0) < 4200; if (!p.g.visible) continue;
      p.g.position.set(x, y, z); p.g.rotation.set(r.bank, -(R.yaw + r.yo), r.pitch);
      const u = p.g.userData; u.gear.visible = r.alt < 35; blink(u, T + p.idx, r.landing || r.alt < 400); glowScale(u, Math.hypot(x - cx0, y - camera.position.y, z - cz0));
    }
    for (const c of cruisers) {
      const L = 46000, tt = ((T + c.off) * c.sp) % L; const co = Math.cos(c.ang), si = Math.sin(c.ang); const mx0 = W / 2 + Math.cos(c.ang + 1.57) * c.side, mz0 = W / 2 + Math.sin(c.ang + 1.57) * c.side;
      const x = mx0 + co * (tt - L / 2), z = mz0 + si * (tt - L / 2); c.g.visible = Math.hypot(x - cx0, z - cz0) < 4200; if (!c.g.visible) continue;
      c.g.position.set(x, c.alt, z); c.g.rotation.set(0, -c.ang, 0.02); c.g.userData.gear.visible = false; blink(c.g.userData, T + c.off, false); glowScale(c.g.userData, Math.hypot(x - cx0, c.alt - camera.position.y, z - cz0));
    }
  }
  function glowScale(u, d) { const k = Math.min(20, Math.max(1.6, d * 0.0042)); for (const sp of u.sprites) sp.scale.setScalar(k * (sp.parent === u.beacon ? 0.7 : 1)); }
  function blink(u, T, lights) { // strobes flash twice a second, the belly beacon pulses, landing lights burn only low down
    const st = (T * 1.15) % 1 < 0.07 || ((T * 1.15) % 1 > 0.16 && (T * 1.15) % 1 < 0.22); for (const s of u.strobes) { s.visible = st; }
    if (u.beacon) u.beacon.visible = (T * 0.9) % 1 < 0.45; for (const l of u.landing) l.visible = lights;
  }
  function metroAt(L, s) { const pts = L.pts; let lo = 0, hi = pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; } const a = pts[lo], b = pts[lo + 1]; const f = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.z - a.z, b.x - a.x) }; }
  function updateMetro(dt) {
    if (!trains.length) return;
    const cx = camera.position.x, cz = camera.position.z;
    for (const tr of trains) {
      const L = tr.L, sts = L.stations;
      // a train rolls to the next station, brakes to stop exactly there, waits with its doors open, then carries on (and turns round at the ends)
      if (tr.dwell > 0) { tr.dwell -= dt; tr.v = 0; if (tr.dwell <= 0) { if (L.loop) tr.next = (tr.next + 1) % sts.length; else { if (tr.next + tr.dir < 0 || tr.next + tr.dir >= sts.length) tr.dir = -tr.dir; tr.next = Math.max(0, Math.min(sts.length - 1, tr.next + tr.dir)); } } }
      else {
        const target = sts[tr.next].s; let dist = (target - tr.s) * tr.dir; if (L.loop) { dist = ((dist % L.len) + L.len) % L.len; if (dist > L.len * 0.95) dist -= L.len; } // metres still to go (negative = overshot)
        const vWant = Math.min(tr.vmax, Math.sqrt(Math.max(0, 2 * (tr.dec * 0.88) * Math.max(0, dist - 0.4))) + 0.8);
        tr.v += clamp(vWant - tr.v, -tr.dec * dt, tr.acc * dt);
        tr.s += tr.dir * tr.v * dt; if (L.loop) tr.s = ((tr.s % L.len) + L.len) % L.len;
        if (dist < 0.7 && tr.v < 2.2) { tr.s = target; tr.v = 0; tr.dwell = (tr.fast ? 20 : 7) + (tr.next % 3) * 2; }
      }
      const head = metroAt(L, tr.s); tr.g.visible = Math.hypot(head.x - cx, head.z - cz) < (tr.fast ? 4200 : 3000); if (!tr.g.visible) continue;
      const lo = tr.fast ? 6 : 4; tr.cars.forEach((c, k) => { const sk = tr.s - tr.dir * k * tr.spacing; const q = metroAt(L, L.loop ? ((sk % L.len) + L.len) % L.len : clamp(sk, lo, L.len - lo)); c.position.set(q.x, q.y + (tr.fast ? 2.3 : 2.0), q.z); c.rotation.y = -(q.yaw + (tr.dir < 0 ? Math.PI : 0)); });
    }
    // station name boards are made only when the camera first comes close (there are hundreds of stations)
    for (const o of stationSigns) {
      const d = Math.hypot(o.st.x - cx, o.st.z - cz);
      if (!o.sp) { if (d > 520) continue; o.sp = labelSprite(o.st.name.toUpperCase() + (o.L.fast ? " BULLET TRAIN" : " METRO"), "#" + o.col.getHexString(), o.L.name, o.L.fast ? "🚄" : "🚇"); o.sp.position.set(o.st.x, o.st.y + 16, o.st.z); o.sp.scale.multiplyScalar(0.9); scene.add(o.sp); }
      o.sp.visible = d < 520;
    }
  }
  function update(realDt, simDt) {
    clock += realDt; const P = G.player;
    if (landmarkGroup.userData.beamUpdate) landmarkGroup.userData.beamUpdate(clock, T.lampK, cam.x, cam.z); // the casino searchlights sweep at night
    if (todAuto) { if (!G.pause) todClock += Math.min(realDt, 0.25); stepAutoTod(false); }
    if (cam.lx !== undefined && Math.hypot(P.x - cam.lx, P.z - cam.lz) > 40) { cam.snap = true; cam.init = false; } cam.lx = P.x; cam.lz = P.z;
    refreshPlayer(); place(playerMesh, P, simDt || 0); tumbleStep(P, realDt); playerMesh.userData.tailMat.color.setHex(P.braking ? 0xff3b2b : 0xb81616);
    playerMesh.visible = cam.mode < 2; cockpit.group.visible = cam.mode === 3;
    if (cam.mode === 3) cockpit.update(realDt, P, G.weather.rain, clock, (playerMesh.userData.spec && playerMesh.userData.spec.color) || "#2de2ff");
    { const ug = playerMesh.userData.glow; if (ug) { if (!ug.userData.base) ug.userData.base = ug.material.color.clone(); ug.material.opacity = 0.8 + (P.nos ? 0.2 : 0) + (P.drifting ? 0.1 : 0); if (P.nos) ug.material.color.setHex(0xffffff); else ug.material.color.copy(ug.userData.base); } } // underglow flares white on nitrous
    for (const f of playerMesh.userData.flames) { f.visible = P.nos; if (P.nos) f.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 1); }
    syncRacers(); syncTraffic();
    setWindTime(clock);
    // plants: the rich version near the car, the light one further out (swapped by chunk distance, nothing is rebuilt)
    for (const grp of loaded.values()) applyTier(grp);
    // stream the city
    const ci = Math.floor(P.x / CH), cj = Math.floor(P.z / CH);
    if (ci !== lastCi || cj !== lastCj) { lastCi = ci; lastCj = cj; dropFar(ci, cj); }
    const want = wanted(ci, cj, Math.cos(P.yaw), Math.sin(P.yaw)); if (want.length || job) streamStep(want, ci, cj);
    // wet roads
    const rainK = Math.max(G.weather.rain, T.sheen * (window.__mbNoSheen ? 0 : 1)); /* street sheen: NFSU2 roads always look freshly wet at night */ mats.road.roughness = 0.9 - 0.78 * rainK; if (mats.road.bumpMap !== road.rm) { mats.road.bumpMap = road.rm; mats.road.needsUpdate = true; } mats.road.bumpScale = 0.9 + 1.6 * rainK; mats.decal.roughness = mats.road.roughness; mats.decal.metalness = mats.road.metalness; mats.decal.envMapIntensity = mats.road.envMapIntensity; mats.walk.roughness = 0.9 - 0.45 * rainK; mats.road.metalness = 0.12 + 0.25 * rainK; mats.road.envMapIntensity = 0.9 + 1.6 * rainK; mats.pool.opacity = T.lampK; reflU.uWetK.value = G.weather.rain; reflU.uAsphK.value = 1 - 0.35 * rainK;
    rain.material.opacity = 0.2 * G.weather.rain; rain.visible = G.weather.rain > 0.02;
    sea.material.roughness = 0.16 + 0.12 * G.weather.rain; scene.fog.far = (T.fog.far - 380 * G.weather.rain) * fogK; scene.fog.near = Math.max(12, T.fog.near - 60 * G.weather.rain);
    bumpSea(); updateMetro(realDt); updatePlanes(realDt);
    // lights
    headL.position.set(P.x, P.y + 1.2, P.z); headL.target.position.set(P.x + Math.cos(P.yaw) * 30, P.y, P.z + Math.sin(P.yaw) * 30); underL.position.set(P.x, P.y + 0.5, P.z); underL.intensity = P.nos ? 14 : 6;
    // billboards
    scene.getObjectByName("haze").children.forEach((m) => { m.quaternion.copy(camera.quaternion); const d = Math.hypot(m.position.x - camera.position.x, m.position.z - camera.position.z); const r = m.geometry.parameters.width / 3.4; const k = clamp((d - r * 0.9) / (r * 1.4), 0, 1); if (m.userData.op === undefined) m.userData.op = m.material.opacity; m.material.opacity = m.userData.op * k * T.haze; m.visible = k > 0.01 && T.haze > 0.01; });
    // particles
    if (realDt > 0) {
      if (P.drifting && P.speed > 15) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); for (const side of [-1, 1]) { const lx = -1.4, lz = side * 0.95; emit(smoke, P.x + cs * lx - sn * lz, P.y + 0.25, P.z + sn * lx + cs * lz, (Math.random() - 0.5) * 2 - P.vx * 0.08, 0.6 + Math.random(), (Math.random() - 0.5) * 2 - P.vz * 0.08, 1.4, 1.8, 5.5, 0.55, 0.85, 0.95, 0.6); } }
      if (G.cam.hit > 4) { for (let k = 0; k < 5; k++) emit(sparks, P.x, P.y + 0.5, P.z, (Math.random() - 0.5) * 14, 2 + Math.random() * 5, (Math.random() - 0.5) * 14, 0.5, 0.4, 0, 1, 0.75, 0.3, 1); }
      if (P.nos) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); emit(sparks, P.x + cs * -2.9, P.y + 0.55, P.z + sn * -2.9, -cs * 8 + (Math.random() - 0.5), Math.random(), -sn * 8 + (Math.random() - 0.5), 0.35, 0.8, 0.5, 0.3, 0.6, 1, 0.8); }
      if (G.wet && P.speed > 22) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); for (const side of [-1, 1]) emit(smoke, P.x + cs * -1.4 - sn * side * 0.95, P.y + 0.25, P.z + sn * -1.4 + cs * side * 0.95, -P.vx * 0.12 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -P.vz * 0.12 + (Math.random() - 0.5) * 2, 0.9, 0.8, 2.5, 0.28, 0.32, 0.4, 0.35); }
      stepPS(smoke, realDt, 1.4, 0.2); stepPS(sparks, realDt, 0.8, -9);
      if (sakAv.length) { // petals fade in as you come within reach of an avenue and thin out again after it
        let kk = 0; for (const a of sakAv) { const R = (a.s1 - a.s0) / 2, d = Math.hypot(a.x - P.x, a.z - P.z); kk = Math.max(kk, clamp((R * 1.25 - d) / (R * 0.35), 0, 1)); }
        petals.visible = kk > 0.01;
        if (petals.visible) { const W = 56, tt = clock; for (let i = 0; i < PET_N; i++) { const a = petSeed[i * 3], b = petSeed[i * 3 + 1], c = petSeed[i * 3 + 2];
            petPos[i * 3] = P.x + ((((a * W * 2 - P.x + tt * (c - 0.5) * 2.4) % W) + W) % W) - W / 2 + Math.sin(tt * 1.3 + a * 40) * 0.9; petPos[i * 3 + 2] = P.z + ((((c * W * 2 - P.z + tt * (a - 0.5) * 2.4) % W) + W) % W) - W / 2 + Math.cos(tt * 1.1 + c * 40) * 0.9;
            petPos[i * 3 + 1] = P.y + 0.2 + 9 - (((b * 9 + tt * (0.45 + c * 0.6)) % 9)); }
          petGeo.attributes.position.needsUpdate = true; petMat.opacity = 0.8 * kk; }
      }
      { const W = 70, tt = clock; for (let i = 0; i < EMB_N; i++) { const a = embSeed[i * 3], b = embSeed[i * 3 + 1], c = embSeed[i * 3 + 2];
          embPos[i * 3] = P.x + ((((a * W * 2 - P.x + tt * (c - 0.5) * 3) % W) + W) % W) - W / 2; embPos[i * 3 + 2] = P.z + ((((c * W * 2 - P.z + tt * (a - 0.5) * 3) % W) + W) % W) - W / 2;
          embPos[i * 3 + 1] = P.y + 0.3 + (((b * 11 + tt * (0.4 + c * 0.8)) % 11)); }
        embGeo.attributes.position.needsUpdate = true; const nosK = P.nos ? 1 : 0; embMat.color.setHex(nosK ? 0x6fd8ff : T.embColor); embMat.opacity = Math.min(0.75, 0.22 + Math.min(1, P.speed / 60) * 0.35 + (P.drifting ? 0.15 : 0) + nosK * 0.2) * (nosK ? 1 : T.embers); }

    }
    updateCamera(realDt, P); if (view.debugCam) { const d = view.debugCam; camera.position.set(d.x, d.y, d.z); camera.lookAt(d.lx, d.ly, d.lz); if (d.roll) camera.rotateZ(d.roll); if (d.fov && Math.abs(camera.fov - d.fov) > 0.01) { camera.fov = d.fov; camera.updateProjectionMatrix(); } camera.updateMatrixWorld(); } syncMarkers(P, realDt);
    if (gradePass) { const u = gradePass.uniforms; u.uTime.value = clock; u.uRain.value = G.weather.rain; const kickK = Math.pow(clamp((P.kick || 0) / 0.7, 0, 1), 1.3); // Upgrade 39: 1 the instant the nitrous hits, fading to 0 over 0.7 s
      const tb = clamp((P.speed - 36) / 50, 0, 1) * 0.105 + (P.nos ? 0.085 : 0) + kickK * 0.06; u.uBlur.value += (tb - u.uBlur.value) * Math.min(1, realDt * (tb > u.uBlur.value ? 9 : 4)); u.uCA.value = 0.0008 + Math.min(1, P.speed / 70) * 0.0016 + (P.nos ? 0.0026 : 0) + kickK * 0.005;
      { const st = clamp((P.speed - 30) / 42, 0, 1) * 0.55 + (P.nos ? 0.45 : 0); u.uStreak.value += (st - u.uStreak.value) * Math.min(1, realDt * (st > u.uStreak.value ? 6 : 3)); u.uFlash.value = kickK * 0.55; }
      // sun glare: only while the sun is low and in front of the camera
      { const sd = T.sun.dir, sg = _sunV; sg.set(sd[0], sd[1], sd[2]).multiplyScalar(1000).add(camera.position).project(camera);
        const low = clamp(1 - (sd[1] - 0.05) / 0.35, 0, 1) * (T.name === "night" ? 0 : 1); const vis = sg.z < 1 && Math.abs(sg.x) < 1.3 && Math.abs(sg.y) < 1.3 ? 1 - Math.max(Math.abs(sg.x), Math.abs(sg.y)) * 0.5 : 0;
        u.uSun.value.set(sg.x * 0.5 + 0.5, sg.y * 0.5 + 0.5, low * vis * MWG.glare * 0.5 * (G.weather.rain > 0.3 ? 0.4 : 1)); } }
    // rain streaks follow the camera
    if (rain.visible) { const base = rbase; for (let i = 0; i < RN; i++) { base[i * 3 + 1] -= realDt * 38; if (base[i * 3 + 1] < 0) base[i * 3 + 1] += 40; const x = camera.position.x + base[i * 3], y = camera.position.y - 8 + base[i * 3 + 1], z = camera.position.z + base[i * 3 + 2]; rpos[i * 6] = x; rpos[i * 6 + 1] = y; rpos[i * 6 + 2] = z; rpos[i * 6 + 3] = x - P.vx * 0.012; rpos[i * 6 + 4] = y + 1.1; rpos[i * 6 + 5] = z - P.vz * 0.012; } rgeo.attributes.position.needsUpdate = true; }
    crowd.setCar && crowd.setCar(G.player);     fest.update(realDt, camera.position, 1);
    { const h = crowd.takeHits && crowd.takeHits(); if (h && G.pedHit) G.pedHit(h); }
    if (SHADOWS) { shFrame++; if (cam.snap) shFrame = shEvery; if (shFrame >= shEvery) { shFrame = 0; const sx = Math.round(camera.position.x), sz = Math.round(camera.position.z), D = T.sun.dir; moon.target.position.set(sx, P.y, sz); moon.position.set(sx + D[0] * 335, P.y + D[1] * 335, sz + D[2] * 335); renderer.shadowMap.needsUpdate = true; } } // the moon shadows are redrawn every few frames on lighter steps
    govStep(Math.max(0.004, realDt - streamPrev / 1000)); streamPrev = streamStat.frameMs; streamStat.frameMs = 0; // block-building time is not the picture's fault, so it does not lower the quality
    if (reflMode === "on" && !opts.lite && rainK > 0.12) renderReflection(P.y, rainK); else if (reflU.uReflK.value) { reflU.uReflK.value = 0; reflU.tRefl.value = reflDummy; }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  // ---- the governor: watches the frame rate and moves between the quality steps -----------------------------------------------------------------------
  const gov = { n: 0, t: 0, c: 0, cool: 3.5, good: 0, probing: false, probeKind: "", ceiling: QMAX, ceilUntil: 0, cutFloor: 0, cutUntil: 0, waitUp: 6, age: 0, saved: -1 };
  function setLevel(L) { level = L; applyLevel(L); }
  function setCut(c) { cpuCut = Math.max(0, Math.min(3, c)); applyLevel(level); }
  function saveLevel() { if (gov.saved === level) return; gov.saved = level; try { localStorage.setItem("mb-q", JSON.stringify({ r: gpuName, l: level })); } catch {} }
  function govStep(realDt) {
    if (!govOn() || realDt <= 0 || G.pause || (typeof document !== "undefined" && document.hidden)) { gov.n = 0; gov.t = 0; gov.c = 0; return; }
    gov.n++; gov.t += Math.min(realDt, 0.05); if (gov.n < 24) return; // about half a second per look
    const span = gov.t, avg = span / gov.n, cpuShare = gov.c / 1000 / Math.max(0.001, span); gov.n = 0; gov.t = 0; gov.c = 0; gov.age += span; gov.cool -= span; if (gov.cool > 0) return;
    if (gov.cutUntil && gov.age > gov.cutUntil) { gov.cutFloor = 0; gov.cutUntil = 0; }
    if (avg > 0.0215) { // slower than about 46 frames a second
      if (gov.probing) { // the richer step that was just tried did not hold: go back and wait longer before the next try
        gov.probing = false; gov.waitUp = Math.min(180, gov.waitUp * 2);
        if (gov.probeKind === "cpu") { gov.cutFloor = Math.min(3, cpuCut + 1); gov.cutUntil = gov.age + 240; setCut(cpuCut + 1); gov.cool = 2.5; gov.good = 0; return; }
        gov.ceiling = Math.max(0, level - 1); gov.ceilUntil = gov.age + 240;
      }
      // is the processor the bottleneck (most of the frame is spent preparing objects, not waiting for the graphics card)? then a smaller picture would not help
      if (cpuShare > 0.62 && cpuCut < 3) { setCut(cpuCut + 1); gov.cool = gov.age < 20 ? 1.2 : 2.5; }
      else if (level > 0) { setLevel(Math.max(0, level - (avg > 0.034 ? 2 : 1))); gov.cool = gov.age < 20 ? 1.2 : 2.5; }
      gov.good = 0;
    } else if (avg < 0.0188) { // a smooth stretch: after a while, try the next richer step (picture first, then object detail); if it does not hold, come back and wait longer next time
      gov.good += span;
      if (gov.probing && gov.good > 3.5) { gov.probing = false; gov.waitUp = gov.age < 60 ? 6 : Math.max(20, gov.waitUp * 0.8); }
      else if (!gov.probing && gov.good > gov.waitUp) {
        if (level < Math.min(gov.ceiling, QMAX)) { gov.probing = true; gov.probeKind = "gpu"; setLevel(level + 1); gov.cool = 1.0; gov.good = 0; }
        else if (cpuCut > gov.cutFloor) { gov.probing = true; gov.probeKind = "cpu"; setCut(cpuCut - 1); gov.cool = 1.0; gov.good = 0; }
      }
      if (!gov.probing && gov.good > 20) saveLevel();
      if (gov.ceilUntil && gov.age > gov.ceilUntil) { gov.ceiling = QMAX; gov.ceilUntil = 0; }
    } else gov.good = Math.max(0, gov.good - span * 0.5);
  }
  function applyPR(p) { pr = p; renderer.setPixelRatio(pr); if (composer && composer.setPixelRatio) composer.setPixelRatio(pr); resize(); }
  function setResolution(m) { if (!(m in RES_W) && m !== "auto" && m !== "low") return; resMode = m; try { localStorage.setItem("mb-res", m); } catch {} gov.cool = 3; gov.good = 0; gov.probing = false; applyLevel(effLevel(), true); }
  // ---- people and festival seasons ----
  // Upgrade 34: nobody walks the streets of Tokyo Drift
  const NOP = !!opts.noPeople || IS_TOKYO;
  const crowd = NOP ? { setMode() {}, update() { return 0; }, dispose() {} } : createCrowd(scene, world, { max: opts.lite ? 260 : 760 });
  crowdRef = crowd;
  const fest = NOP ? { setMode() {}, update() { return 0; }, dispose() {}, mode: "off" } : createFestival(scene, world, crowd, { dens: (x, z) => districtDens(x, z), onBang: (x, z, d) => { if (opts.onBang) opts.onBang(x, z, d); } });
  let festChoice = "auto"; // Upgrade 34: the festival follows the calendar by itself; the player can no longer pick one
  const festActive = () => (IS_TOKYO ? "off" : festChoice === "auto" ? festivalOn(new Date()) : festChoice); // Tokyo Drift has no festival seasons
  fest.setMode(festActive());

  function bumpSea() { const cl = scene.getObjectByName("clouds"); if (cl) cl.rotation.y = clock * 0.004; seaTex.offset.x = clock * 0.004; seaTex.offset.y = clock * 0.003; }
  function updateCamera(dt, P) {
    const camYaw = P.yaw + clamp(P.lat * 0.012, -0.4, 0.4) * 0 + (P.drifting ? -P.steer * 0.0 : 0);
    const velYaw = P.speed > 4 ? Math.atan2(P.vz, P.vx) : P.yaw; // look along where the car is actually going, a little
    let target = P.yaw; if (P.speed > 8) { let d = velYaw - P.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; target = P.yaw + d * (IS_TOKYO ? 0.5 : 0.35); }
    if (!cam.init) { cam.ang = target; cam.init = true; }
    let da = target - cam.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; cam.ang += da * Math.min(1, dt * (cam.mode >= 2 ? 14 : 5));
    const speed = P.speed, nosOn = P.nos; const speedF = Math.min(1, speed / 60);
    if (cam.mode >= 2) {
      const ck = cam.mode === 3; const ex = ck ? 0.12 : 0.5, ey = ck ? 1.08 : 1.2, side = ck ? 0.34 : 0; // cockpit: driver's seat on the right (cars drive on the left here)
      const rs = Math.sin(P.yaw), rc = Math.cos(P.yaw);
      const bf = speedF * 0.012 + (nosOn ? 0.012 : 0) + Math.pow(clamp((P.kick || 0) / 0.7, 0, 1), 1.3) * 0.05; camera.position.set(P.x + rc * ex - rs * side + (Math.random() - 0.5) * bf, P.y + ey + (Math.random() - 0.5) * bf, P.z + rs * ex + rc * side + (Math.random() - 0.5) * bf);
      camera.lookAt(P.x + Math.cos(cam.ang) * 24, P.y + ey - 0.05 + P.pitch * -4, P.z + Math.sin(cam.ang) * 24);
      if (ck) camera.rotateZ(-P.roll * 0.6);
    }
    else {
      const far = cam.mode === 1 ? 1 : 0;
      // Upgrade 39: the camera falls back when the car surges away (smoothed acceleration) and is thrown back by the nitrous slam, then eases in again
      const accNow = dt > 0 ? (speed - (cam.sp0 ?? speed)) / dt : 0; cam.sp0 = speed; cam.acc = (cam.acc || 0) + (clamp(accNow, -30, 40) - (cam.acc || 0)) * Math.min(1, dt * 2.5);
      const kickK2 = Math.pow(clamp((P.kick || 0) / 0.7, 0, 1), 1.3);
      const back = 7.2 + far * 3.8 + speed * 0.04 + (nosOn ? 2.6 : 0) + clamp(cam.acc, -6, 18) * 0.11 + kickK2 * 2.8;
      const tx = P.x - Math.cos(cam.ang) * back, tz = P.z - Math.sin(cam.ang) * back, ty = P.y + 2.6 + far * 1.5 + speed * 0.006 - speedF * 0.22;
      const kf = 1 - Math.pow(0.0005, dt);
      if (cam.snap) { cam.x = tx; cam.z = tz; cam.y = ty; cam.snap = false; } cam.x += (tx - cam.x) * kf; cam.z += (tz - cam.z) * kf; cam.y += (ty - cam.y) * kf;
      // keep the camera out of buildings: walk from the car towards it and stop short of the first wall
      { const dx = cam.x - P.x, dz = cam.z - P.z, dist = Math.hypot(dx, dz) || 1; let best = dist;
        for (let d = 2.2; d <= dist; d += 1.2) { const x = P.x + dx / dist * d, z = P.z + dz / dist * d; let hit = false;
          world.queryColliders(x, z, (o) => { if (hit || o.t !== 0) return; const px = x - o.x, pz = z - o.z; const lx = px * o.c + pz * o.s, lz = -px * o.s + pz * o.c; if (Math.abs(lx) < o.hw + 0.8 && Math.abs(lz) < o.hd + 0.8 && cam.y < o.y + o.h + 1) hit = true; });
          if (hit) { best = Math.max(2.6, d - 1.6); break; } }
        if (best < dist) { cam.x = P.x + dx / dist * best; cam.z = P.z + dz / dist * best; } }
      // never sink into the road or a hill
      const gy = city.groundH(cam.x, cam.z); const sf = city.surfaceAt(cam.x, cam.z, P.y); cam.y = Math.max(cam.y, (sf ? sf.y : Math.max(gy, city.meshH(cam.x, cam.z))) + 1.1);
      // line of sight: if a crest or a ramp lip is between the camera and the car, rise until the car is in view again
      { const ly = P.y + 1.2; for (let k = 1; k <= 7; k++) { const f = k / 8, sx = cam.x + (P.x - cam.x) * f, sz = cam.z + (P.z - cam.z) * f; const s2 = city.surfaceAt(sx, sz, P.y); const gh = (s2 ? s2.y : Math.max(city.groundH(sx, sz), city.meshH(sx, sz))) + 0.7; const ry = cam.y + (ly - cam.y) * f; if (gh > ry) cam.y += (gh - ry) / (1 - f) * 0.6; } }
      cam.shake = Math.max(cam.shake, G.cam.hit > 4 ? 1 : 0) ; cam.shake = Math.max(0, cam.shake - dt * 3); const sh = cam.shake * 0.35 + (speedF > 0.55 ? (speedF - 0.55) * 0.16 : 0) + (nosOn ? 0.1 : 0) + kickK2 * 0.26; // a faint tremble at speed, stronger on nitrous
      camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z + (Math.random() - 0.5) * sh);
      camera.lookAt(P.x + Math.cos(cam.ang) * 9, P.y + 1.2, P.z + Math.sin(cam.ang) * 9);
    }
    // Most Wanted rush: the view widens with speed and punches wide when the nitrous hits.
    // (Upgrade 39 fix: this used to sit on one line after a // comment, so the widening never actually ran.)
    const fovT = 64 + speedF * 11 + (nosOn ? 7 : 0) + Math.min(7, (P.kick || 0) * 10);
    if (!(cam.fov > 0)) cam.fov = camera.fov || 64;
    cam.fov += (fovT - cam.fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    // the sea, sky and haze follow the camera so they never end
    sea.position.x = camera.position.x; sea.position.z = camera.position.z; const sky = scene.getObjectByName("sky"); sky.position.copy(camera.position); scene.getObjectByName("stars").position.copy(camera.position);
    for (const nm of ["moon", "halo"]) { const o = scene.getObjectByName(nm); o.position.set(camera.position.x + discOff[0], camera.position.y * 0 + discOff[1], camera.position.z + discOff[2]); o.lookAt(camera.position); }
  }
  // load the first chunks and the player's car before the first frame
  async function preload(onProgress) {
    refreshPlayer(); const P = G.player; const ci = Math.floor(P.x / CH), cj = Math.floor(P.z / CH); const want = wanted(ci, cj, 0, 0); let n = 0;
    for (const w of want) { if (w[0] > 6) break; ensureChunk(w[1], w[2]); n++; if (onProgress) onProgress(n / 24); await new Promise((r) => setTimeout(r, 0)); }
    cam.snap = true; cam.init = false;
  }
  function resize() {
    const w = mount.clientWidth || width, h = mount.clientHeight || height;
    const np = prFor(effLevel()); if (Math.abs(np - pr) > 0.015) { pr = np; renderer.setPixelRatio(pr); if (composer && composer.setPixelRatio) composer.setPixelRatio(pr); }
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); const p = renderer.getPixelRatio(); if (gradePass) gradePass.uniforms.uRes.value.set(w * p, h * p); if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / (w * p), 1 / (h * p)); }
  }
  function setCameraMode(m) { cam.mode = m; cam.snap = true; }
  function dispose() { try { fest.dispose(); crowd.dispose(); } catch {} renderer.dispose(); if (composer) composer.dispose && composer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
  const view = { crowd, setReflections(on) { reflMode = on ? "on" : "off"; try { localStorage.setItem("mb-refl", reflMode); } catch {} if (!on) { reflU.uReflK.value = 0; reflU.tRefl.value = reflDummy; } }, get reflections() { return reflMode === "on"; }, setResolution, get resolution() { return resMode; }, get quality() { const L = effLevel(); return { level: L, name: QL[L].name, auto: resMode === "auto", gpu: gpuName, steps: QL.length, pr, cut: cpuCut }; }, noteCpu(ms) { gov.c += ms; }, get level() { return effLevel(); }, setLevel(L) { if (resMode === "auto" && L >= 0 && L <= QMAX) { gov.cool = 6; gov.probing = false; setLevel(L); } }, get renderSize() { const c = renderer.domElement; return [c.width, c.height]; }, setFestival(c) { festChoice = c; try { localStorage.setItem("mb-festival", c); } catch {} fest.setMode(festActive()); }, get festivalChoice() { return festChoice; }, get festivalActive() { return fest.mode; }, festival: fest, festivalNames: FEST_NAMES, update, preload, resize, setCameraMode, dispose, cam, renderer, scene, camera, refreshPlayer, get chunkCount() { return loaded.size; }, prof: null, get streaming() { return { busy: !!job, ...streamStat }; }, resetStreamStat() { streamStat.max = 0; streamStat.built = 0; streamStat.slices = 0; } };
  // ---- time of day: night / dusk / golden hour. Everything that depends on it is set here ---------------------------------------------------------------
  let discOff = [-1800, 1400, -2500];
  function setMatsEnv(oldEnv, newEnv) {
    const seen = new Set(), fix = (m) => { if (!m || seen.has(m)) return; seen.add(m); if (m.envMap === oldEnv) m.envMap = newEnv; };
    const walk = (o) => { if (!o) return; if (o.isMaterial) fix(o); else if (typeof o === "object") for (const k in o) walk(o[k]); };
    for (const k in mats) walk(mats[k]);
    for (const m of vMat.values()) fix(m); fix(glassTM); fix(trimTM);
    scene.traverse((o) => { if (o.material) { if (Array.isArray(o.material)) o.material.forEach(fix); else fix(o.material); } });
  }
  function applyTodObj(Tn) {
    T = Tn; todName = T.name; const lite = !!opts.lite;
    scene.background.setHex(T.fog.color); scene.fog.color.setHex(T.fog.color);
    ambient.color.setHex(T.ambient.color); ambient.intensity = lite ? T.ambient.iLite : T.ambient.i;
    hemi.color.setHex(T.hemi.sky); hemi.groundColor.setHex(T.hemi.ground); hemi.intensity = lite ? T.hemi.iLite : T.hemi.i;
    moon.color.setHex(T.sun.color); moon.intensity = lite ? T.sun.iLite : T.sun.i;
    if (SHADOWS) { moon.shadow.bias = T.sun.bias; const sc = moon.shadow.camera, e = T.sun.extent; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.updateProjectionMatrix(); }
    renderer.toneMappingExposure = T.exposure;
    paintSky(scene.getObjectByName("sky").geometry, T);
    const stars = scene.getObjectByName("stars"); stars.material.opacity = T.stars; stars.visible = T.stars > 0.01;
    const cl = scene.getObjectByName("clouds"); cl.material.color.setHex(T.clouds.color); cl.material.opacity = T.clouds.op;
    const d = T.disc, fade = T.discFade == null ? 1 : T.discFade, mo = scene.getObjectByName("moon"), ha = scene.getObjectByName("halo");
    mo.visible = d.show && fade > 0.01; mo.material.color.setHex(d.color).multiplyScalar(d.I * fade); mo.scale.setScalar(d.radius / 120); ha.visible = d.show && fade > 0.01; ha.material.color.setHex(d.haloColor); ha.material.opacity = d.haloOp * fade; ha.scale.setScalar(d.haloSize / 1200);
    discOff = T.discPos ? T.discPos.slice() : d.at ? d.at.slice() : T.sun.dir.map((v) => v * 3400);
    scene.getObjectByName("farground").material.color.setHex(T.ground); sea.material.color.setHex(T.sea); sea.material.envMapIntensity = T.seaEnv;
    // lights that only make sense in the dark
    mats.glowPts.uniforms.uGain.value = T.lampK; mats.neon.color.setScalar(Math.max(0.4, T.lampK)); mats.pool.opacity = T.lampK;
    for (const k in mats.facade) mats.facade[k].emissiveIntensity = 0.62 * T.winK;
    for (const k in mats.train) { const tw = 0.95 * (0.4 + 0.6 * Math.min(1, T.winK)); mats.train[k].body.emissiveIntensity = tw; mats.train[k].nose.emissiveIntensity = tw; }
    for (const k in mats.band) mats.band[k].emissiveIntensity = 0.85 * T.shopK;
    mats.signs.emissiveIntensity = 0.55 * T.signK; mats.ad.color.setScalar(Math.max(0.45, T.signK)); mats.blade.color.setScalar(Math.max(0.45, T.signK));
    headL.intensity = 140 * T.headK; headL.visible = todAuto ? true : T.headK > 0.02; // while the day runs by itself the light stays switched on (at zero strength by day) so the scene never has to recompile
    if (bloom) { bloom.strength = T.bloom.strength; bloom.radius = T.bloom.radius; bloom.threshold = T.bloom.threshold; }
    if (gradePass) { const u = gradePass.uniforms, g = T.grade; u.uShadow.value.set(...g.shadow); u.uHigh.value.set(...g.high); u.uTeal.value.set(...g.teal); u.uTealK.value = g.tealK * MWG.teal; u.uSat.value = g.sat * MWG.sat; u.uCon.value = g.con * MWG.con; u.uVig.value = g.vig + MWG.vig; u.uWarm.value.set(...MWG.warm); u.uWarmK.value = MWG.warmK; u.uSunCol.value.set(1.0, 0.72, 0.38); }
    // the reflections in paint, glass and wet tarmac follow the sky
    if (todName !== envStage && envMap) { envStage = todName; const old = envMap; try { const ne = makeEnvMap(renderer, { ...PAL, tod: T.env }); envMap = ne; setMatsEnv(old, ne); old.dispose && old.dispose(); } catch {} }
  }
  // the clock: advances only while the game is running; a fade is re-applied a few times a second, a hold costs nothing
  const todLast = { seg: 0, k: 0 };
  function stepAutoTod(force) {
    const c = cycleAt(todClock);
    if (!force && c.seg === todLast.seg && (c.hold || Math.abs(c.k - todLast.k) < 0.004)) return;
    todLast.seg = c.seg; todLast.k = c.k; todPhase = c.label; applyTodObj(todMix(c));
  }
  function setTimeOfDay(n) { if (!TOD[n]) return; todAuto = false; applyTodObj(TOD[n]); } // pins one look — only the intro film and the test pages use this; players have no control over the hour
  function resumeAutoClock() { todAuto = true; stepAutoTod(true); }
  applyTodObj(T);
  view.setTimeOfDay = setTimeOfDay; view.resumeAutoClock = resumeAutoClock; Object.defineProperty(view, "timeOfDay", { get: () => todName }); Object.defineProperty(view, "timeOfDayLabel", { get: () => (todAuto ? todPhase : todName.toUpperCase()) });
  Object.defineProperty(view, "todAuto", { get: () => todAuto }); Object.defineProperty(view, "todClock", { get: () => todClock, set: (v) => { todClock = v; if (todAuto) stepAutoTod(true); } });
  view.fx = { chev, mats, root, moon, hemi, ambient, get composer() { return composer; }, get bloom() { return bloom; }, get gradePass() { return gradePass; }, get fxaaPass() { return fxaaPass; }, crowd, fest };
  view.debug = { trains, planes, stepMetro: (dt) => updateMetro(dt), stepPlanes: (dt) => updatePlanes(dt), planeState: (p, T) => planes.step(p, T), setClock: (v) => { clock = v; } };
  applyLevel(effLevel(), true);
  return view;
}
