import * as THREE from "three";

// A hand-placed set of control points forming an actual winding
// circuit — not a perfect circle. This is what makes steering matter:
// on a circle, holding a constant lane position is nearly free; on a
// real curve, cutting corners and correcting through bends is a
// genuine skill.
const CONTROL_POINTS = [
  [0, -34], [22, -30], [34, -10], [28, 14], [10, 26],
  [-8, 30], [-30, 18], [-38, -6], [-20, -26], [-6, -34],
];

export const TRACK_WIDTH = 9;

export function buildTrackCurve() {
  const points = CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
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

export function buildPylon() {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff5a3c, emissiveIntensity: 0.3 })
  );
  cone.position.y = 0.5;
  return cone;
}
