import * as THREE from "three";

// A real circuit shape: a start/finish straight, a sweeping
// right-hander, an S-chicane (the "zigzag"), a tight hairpin, a long
// back straight, and a final sweeper back to the line. Not a circle —
// on a circle, holding a lane is nearly free; here, corners genuinely
// have to be braked for and steered through.
const CONTROL_POINTS = [
  [0, -38], [18, -37], [32, -26], [37, -8],       // start/finish + sweeping right
  [26, 6], [33, 17], [15, 21],                     // S-chicane (zigzag)
  [1, 15], [-6, 28], [-19, 19],                    // tight hairpin, pulled sharper
  [-32, 24], [-38, 4], [-36, -16],                 // back straight
  [-24, -32], [-10, -38],                          // final sweeper back to line
];

export const TRACK_WIDTH = 7.4;

export function buildTrackCurve() {
  const points = CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.45);
}

// How sharply the track is turning at t (0 = straight, higher =
// tighter corner) — lets the physics make fast cornering genuinely
// risky rather than cosmetic.
export function trackCurvatureAt(curve, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const delta = 0.006;
  const tangentA = curve.getTangentAt(wrapped).normalize();
  const tangentB = curve.getTangentAt((wrapped + delta) % 1).normalize();
  return tangentA.angleTo(tangentB) / delta;
}

// Builds a flat road ribbon that actually follows the curve (as
// opposed to a tube, which would be circular in cross-section).
export function buildTrackGeometry(curve, segments = 220) {
  const positions = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) % 1;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const left = point.clone().addScaledVector(side, TRACK_WIDTH / 2);
    const right = point.clone().addScaledVector(side, -TRACK_WIDTH / 2);
    positions.push(left.x, 0, left.z, right.x, 0, right.z);
    uvs.push(0, i / segments, 1, i / segments);
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, b, d, a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Given lap progress t (0..1, wraps automatically) returns the point
// on the road's centerline, the direction of travel there, and the
// sideways vector — everything needed to place a car, a pylon, or the
// camera correctly at that point on the track.
export function trackPointAt(curve, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const point = curve.getPointAt(wrapped);
  const tangent = curve.getTangentAt(wrapped).normalize();
  const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
  return { point, tangent, side };
}

// Precomputes points all the way around the track once at scene
// setup. Used every frame to find how close the car's actual (free-
// moving) position is to the racing line — this is what makes
// steering matter: the car is no longer glued to the track's shape,
// so if you don't turn through a corner, you drive straight off it.
export function sampleTrackPoints(curve, count = 300) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const point = curve.getPointAt(t);
    samples.push({ t, x: point.x, z: point.z });
  }
  return samples;
}

// Cheap nearest-neighbor search over the precomputed samples — 300
// basic distance checks is trivial at 60fps, no need for anything
// fancier.
export function findNearestTrackPoint(samples, x, z) {
  let best = samples[0];
  let bestDist = Infinity;
  for (const s of samples) {
    const dx = s.x - x;
    const dz = s.z - z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return { t: best.t, distance: Math.sqrt(bestDist) };
}

// A proper multi-part low-poly car — chassis, angled nose, windshield,
// cabin, rear spoiler on struts, four wheels, headlights, taillights —
// built entirely from primitives (no external model files needed).
export function buildCar(bodyColor) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.35, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0620, metalness: 0.4, roughness: 0.3 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 3.4), bodyMat);
  chassis.position.y = 0.4;
  group.add(chassis);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.9), bodyMat);
  nose.position.set(0, 0.32, -1.9);
  group.add(nose);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.1), darkMat);
  windshield.position.set(0, 0.75, -0.35);
  windshield.rotation.x = Math.PI / 7;
  group.add(windshield);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.4), darkMat);
  cabin.position.set(0, 0.85, 0.4);
  group.add(cabin);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), darkMat);
  spoiler.position.set(0, 0.85, 1.75);
  group.add(spoiler);
  [-0.7, 0.7].forEach((x) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), darkMat);
    strut.position.set(x, 0.62, 1.75);
    group.add(strut);
  });

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f });
  [
    [-0.9, -1.1], [0.9, -1.1], [-0.9, 1.1], [0.9, 1.1],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.34, z);
    group.add(wheel);
  });

  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
  [-0.5, 0.5].forEach((x) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headlightMat);
    light.position.set(x, 0.4, -2.3);
    group.add(light);
  });

  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3ea5, emissive: 0xff3ea5, emissiveIntensity: 0.9 });
  [-0.6, 0.6].forEach((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.08), tailMat);
    light.position.set(x, 0.45, 1.68);
    group.add(light);
  });

  return group;
}

// Finds the sharpest corners on the track automatically (rather than
// hardcoding positions) — used to place gravel run-off exactly where
// it matters, and stays correct even if the track shape changes later.
export function findSharpCornerSpots(curve, count = 6) {
  const samples = 200;
  const candidates = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    candidates.push({ t, curvature: trackCurvatureAt(curve, t) });
  }
  candidates.sort((a, b) => b.curvature - a.curvature);
  const spots = [];
  for (const c of candidates) {
    if (spots.some((s) => Math.abs(s - c.t) < 0.06)) continue;
    spots.push(c.t);
    if (spots.length >= count) break;
  }
  return spots;
}

export function buildPylon() {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff5a3c, emissiveIntensity: 0.3 })
  );
  cone.position.y = 0.5;
  return cone;
}

// A simple low-poly pine — trunk + two stacked cone tiers — for
// trackside scenery outside the road.
export function buildTree() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3420 })
  );
  trunk.position.y = 0.7;
  group.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1f5c3a });
  const tierOne = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 7), foliageMat);
  tierOne.position.y = 2.0;
  group.add(tierOne);
  const tierTwo = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.3, 7), foliageMat);
  tierTwo.position.y = 2.9;
  group.add(tierTwo);

  const scale = 0.85 + Math.random() * 0.5;
  group.scale.set(scale, scale, scale);
  return group;
}

// A flat patch of gravel just off the track edge — a visual and (via
// its position) a gameplay cue for exactly where run-off starts.
export function buildGravelPatch() {
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a7455, roughness: 1 })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.01;
  return patch;
}

// A simple tiered grandstand with a roof and a scatter of
// spectator-colored dots — trackside scenery, not just an empty field.
export function buildGrandstand(accentColor) {
  const group = new THREE.Group();
  const tiers = 4;
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x2a1560 });
  for (let i = 0; i < tiers; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 1.4), stepMat);
    step.position.set(0, 0.3 + i * 0.6, -i * 1.1);
    group.add(step);
    for (let c = 0; c < 11; c++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 6),
        new THREE.MeshStandardMaterial({ color: c % 3 === 0 ? accentColor : 0xf5f0ff })
      );
      dot.position.set(-4 + c * 0.8, 0.65 + i * 0.6, -i * 1.1);
      group.add(dot);
    }
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 0.15, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x12092b })
  );
  roof.position.set(0, tiers * 0.6 + 1.3, -tiers * 0.55);
  group.add(roof);
  [-4.4, 4.4].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, tiers * 0.6 + 1, 6), stepMat);
    post.position.set(x, (tiers * 0.6 + 1.3) / 2, -tiers * 0.55);
    group.add(post);
  });
  return group;
}
