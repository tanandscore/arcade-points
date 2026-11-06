import * as THREE from "three";

// A small procedural canvas texture — a woven/armor-plate pattern
// tinted to the fighter's own color. This is what actually separates
// "flat plastic-looking box" from "has real surface detail," and it's
// achievable with zero external assets: just drawing onto an HTML
// canvas and using that as a texture map, a standard browser API.
function createArmorTexture(colorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const c = new THREE.Color(colorHex);
  ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  ctx.fillRect(0, 0, 128, 128);

  // subtle grain
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }

  // diagonal weave lines — reads as fabric/armor plating at this scale
  ctx.strokeStyle = "rgba(0,0,0,0.09)";
  ctx.lineWidth = 1;
  for (let i = -128; i < 256; i += 7) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - 128, 128);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// A soft glow halo behind an emissive point — a camera-facing sprite
// with additive blending. This fakes a real bloom effect without
// needing a full post-processing pipeline (which would mean adding
// new build dependencies — not worth the risk for this).
function addGlow(parent, color, size, position) {
  const mat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.position.copy(position);
  parent.add(sprite);
  return sprite;
}

// Builds a stylized 3D humanoid from primitives, rigged with pivot
// groups at the shoulders/hips so limbs can be rotated for attack
// poses. Procedural armor texture, glow highlights, tapered
// (cylinder, not box) limbs for a rounder silhouette, shoulder armor,
// gloves, boots, glowing eyes, and a light cape — while staying
// deliberately away from any hooded-ninja-mask look, so nothing here
// resembles a specific existing character design.
export function buildFighterModel(mainColor, accentColor) {
  const fighter = new THREE.Group();
  const skin = 0xd9a066;
  const armorTexture = createArmorTexture(mainColor);
  const mainMat = new THREE.MeshStandardMaterial({ color: mainColor, map: armorTexture, roughness: 0.55, metalness: 0.12 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18102e, roughness: 0.6, metalness: 0.2 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 1.6 });

  const hips = new THREE.Group();
  hips.position.y = 1.9;
  fighter.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.35, 0.62), mainMat);
  torso.position.y = 0.75;
  hips.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.22, 0.64), accentMat);
  chestStripe.position.y = 1.05;
  hips.add(chestStripe);
  addGlow(hips, accentColor, 1.1, new THREE.Vector3(0, 1.05, 0.4));

  // A light cape — swayed gently each frame from the game component —
  // adds silhouette and motion without any facial covering.
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.3, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0x18102e, roughness: 0.6, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.85, 0.34);
  hips.add(cape);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), skinMat);
  head.position.y = 1.7;
  hips.add(head);

  [-0.13, 0.13].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(x, 1.74, 0.36);
    hips.add(eye);
    addGlow(hips, accentColor, 0.22, new THREE.Vector3(x, 1.74, 0.36));
  });

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), accentMat);
  visor.position.set(0, 1.55, 0.38);
  hips.add(visor);

  function buildLimbPivot(x, y, isArm) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const length = isArm ? 1.0 : 1.05;
    // A slight taper (wider at the shoulder/hip end, narrower toward
    // the hand/foot) reads as a real limb far better than a straight
    // box — cheap to do, since CylinderGeometry supports two radii
    // natively.
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, length, 10),
      isArm ? skinMat : mainMat
    );
    limb.position.y = -length / 2;
    pivot.add(limb);

    // Gloves / boots at the end of each limb.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.4), darkMat);
    cap.position.y = -length + 0.05;
    pivot.add(cap);

    if (isArm) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), accentMat);
      pauldron.position.y = 0.05;
      pivot.add(pauldron);
    }
    return pivot;
  }

  const rightArmPivot = buildLimbPivot(0.72, 1.35, true);
  const leftArmPivot = buildLimbPivot(-0.72, 1.35, true);
  hips.add(rightArmPivot, leftArmPivot);

  const rightLegPivot = buildLimbPivot(0.35, 0, false);
  const leftLegPivot = buildLimbPivot(-0.35, 0, false);
  hips.add(rightLegPivot, leftLegPivot);

  // Shadows read as real depth cues far more than any single geometry
  // detail — every solid part of the fighter both casts and receives.
  fighter.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  fighter.userData = {
    hips,
    torso,
    head,
    cape,
    rightArmPivot,
    leftArmPivot,
    rightLegPivot,
    leftLegPivot,
    poseTargets: {},
    hitScale: 1,
  };
  fighter.scale.setScalar(1.05);
  return fighter;
}

const POSE_TARGETS = {
  idle: {},
  punch: { rightArmPivot: { x: -2.0 }, torso: { y: 0.15 } },
  kick: { rightLegPivot: { x: -1.7 }, torso: { z: -0.1 } },
  block: { rightArmPivot: { x: -1.5, z: -0.4 }, leftArmPivot: { x: -1.5, z: 0.4 } },
  special: { rightArmPivot: { x: -2.3 }, leftArmPivot: { x: -2.3 }, torso: { x: -0.15 } },
  hit: { torso: { x: 0.25 } },
};

// Sets the TARGET pose — actual movement toward it happens smoothly
// over several frames via updatePoseBlend, instead of snapping
// instantly. This alone makes the fighters read as animated rather
// than a slideshow of static frames.
export function applyPose(fighter, pose) {
  fighter.userData.currentPoseTarget = POSE_TARGETS[pose] || POSE_TARGETS.idle;
  fighter.userData.hipDrop = pose === "hit" ? 0.12 : 0;
  if (pose === "hit") triggerHitReaction(fighter);
}

// Squash-and-stretch on impact — a classic animation principle, and
// genuinely one of the highest-impact-per-line-of-code things you can
// add to make hits feel like they actually land.
export function triggerHitReaction(fighter) {
  fighter.userData.hitImpulse = 1;
}

// Call once per render frame for every active fighter — smoothly
// interpolates each rigged part toward its current pose target, and
// eases out any active hit-impact squash/stretch.
export function updatePoseBlend(fighter) {
  const { rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot, torso, hips, cape } = fighter.userData;
  const target = fighter.userData.currentPoseTarget || {};
  const BLEND = 0.22;

  function blendPart(part, key) {
    const t = target[key] || {};
    part.rotation.x += ((t.x || 0) - part.rotation.x) * BLEND;
    part.rotation.y += ((t.y || 0) - part.rotation.y) * BLEND;
    part.rotation.z += ((t.z || 0) - part.rotation.z) * BLEND;
  }

  blendPart(rightArmPivot, "rightArmPivot");
  blendPart(leftArmPivot, "leftArmPivot");
  blendPart(rightLegPivot, "rightLegPivot");
  blendPart(leftLegPivot, "leftLegPivot");
  blendPart(torso, "torso");

  const targetY = 1.9 - (fighter.userData.hipDrop || 0);
  hips.position.y += (targetY - hips.position.y) * BLEND;

  if (cape) {
    fighter.userData.capeSway = (fighter.userData.capeSway || 0) + 0.06;
    cape.rotation.x = Math.sin(fighter.userData.capeSway) * 0.08;
  }

  if (fighter.userData.hitImpulse > 0.01) {
    const impulse = fighter.userData.hitImpulse;
    const squashX = 1 + impulse * 0.14;
    const squashY = 1 - impulse * 0.18;
    fighter.scale.set(1.05 * squashX, 1.05 * squashY, 1.05 * squashX);
    fighter.userData.hitImpulse *= 0.78;
  } else if (fighter.userData.hitImpulse !== undefined) {
    fighter.userData.hitImpulse = 0;
    fighter.scale.set(1.05, 1.05, 1.05);
  }
}
