import * as THREE from "three";

// Builds a stylized 3D humanoid from primitives, rigged with pivot
// groups at the shoulders/hips so limbs can be rotated for simple
// attack poses — the same "primitives as a rig" approach used for the
// racing cars elsewhere in this codebase, applied to a fighter.
export function buildFighterModel(mainColor, accentColor) {
  const fighter = new THREE.Group();
  const skin = 0xd9a066;
  const mainMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });

  const hips = new THREE.Group();
  hips.position.y = 1.9;
  fighter.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.35, 0.62), mainMat);
  torso.position.y = 0.75;
  hips.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.22, 0.64), accentMat);
  chestStripe.position.y = 1.05;
  hips.add(chestStripe);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), skinMat);
  head.position.y = 1.68;
  hips.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.42), accentMat);
  visor.position.y = 1.7;
  visor.position.z = 0.05;
  hips.add(visor);

  function buildLimbPivot(x, y, isArm) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const length = isArm ? 1.0 : 1.05;
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.32, length, 0.32), isArm ? skinMat : mainMat);
    limb.position.y = -length / 2;
    pivot.add(limb);
    return pivot;
  }

  const rightArmPivot = buildLimbPivot(0.72, 1.35, true);
  const leftArmPivot = buildLimbPivot(-0.72, 1.35, true);
  hips.add(rightArmPivot, leftArmPivot);

  const rightLegPivot = buildLimbPivot(0.35, 0, false);
  const leftLegPivot = buildLimbPivot(-0.35, 0, false);
  hips.add(rightLegPivot, leftLegPivot);

  fighter.userData = { hips, torso, head, rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot };
  fighter.scale.setScalar(1.05);
  return fighter;
}

// Discrete pose-snap animation — sets target rotations instantly for
// the attack frame, then returns to idle a short time later. Simple
// and reliable rather than a full tweened animation curve, matching
// the pace of a fast-cut fighting game.
export function applyPose(fighter, pose) {
  const { rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot, hips, torso } = fighter.userData;
  rightArmPivot.rotation.set(0, 0, 0);
  leftArmPivot.rotation.set(0, 0, 0);
  rightLegPivot.rotation.set(0, 0, 0);
  leftLegPivot.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0);
  hips.position.y = 1.9;

  if (pose === "punch") {
    rightArmPivot.rotation.x = -2.0;
    torso.rotation.y = 0.15;
  } else if (pose === "kick") {
    rightLegPivot.rotation.x = -1.7;
    torso.rotation.z = -0.1;
  } else if (pose === "block") {
    rightArmPivot.rotation.x = -1.5;
    leftArmPivot.rotation.x = -1.5;
    rightArmPivot.rotation.z = -0.4;
    leftArmPivot.rotation.z = 0.4;
  } else if (pose === "special") {
    rightArmPivot.rotation.x = -2.3;
    leftArmPivot.rotation.x = -2.3;
    torso.rotation.x = -0.15;
  } else if (pose === "hit") {
    torso.rotation.x = 0.25;
    hips.position.y = 1.78;
  }
  // "idle" — everything already reset above
}
