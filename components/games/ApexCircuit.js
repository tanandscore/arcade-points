"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const TRACK_RADIUS = 30;
const TRACK_WIDTH = 10;
const LAP_SPEED_BASE = 0.014;

export default function ApexCircuit({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [supported, setSupported] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [boosts, setBoosts] = useState(0);
  const [offTrack, setOffTrack] = useState(false);

  const sceneRef = useRef(null);
  const stateRef = useRef({
    theta: 0,
    radiusOffset: 0, // steering position within the track band, -1..1
    speed: LAP_SPEED_BASE,
    boostTimer: 0,
    boosts: 0,
    distanceScore: 0,
    steerInput: 0, // -1 left, 0 straight, 1 right
  });
  const timerRef = useRef(null);
  const finishedRef = useRef(false);
  const frameRef = useRef(null);
  const resizeHandlerRef = useRef(null);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    sfx.lose();
    const score = Math.round(stateRef.current.distanceScore) + stateRef.current.boosts * 40;
    onFinish(Math.max(0, score));
  }

  function begin() {
    if (!mountRef.current) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setSupported(false);
      return;
    }

    setStarted(true);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12092b);
    scene.fog = new THREE.Fog(0x12092b, 40, 130);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 500);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x1a0f38 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    // Track (flattened torus ring)
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(TRACK_RADIUS, TRACK_WIDTH / 2, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0x241154 })
    );
    track.rotation.x = Math.PI / 2;
    scene.add(track);

    // Track edge glow lines
    const edgeMat = new THREE.MeshBasicMaterial({ color: accentColor || "#3ee6e0" });
    [TRACK_RADIUS - TRACK_WIDTH / 2, TRACK_RADIUS + TRACK_WIDTH / 2].forEach((r) => {
      const edge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.15, 8, 100), edgeMat);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = 0.05;
      scene.add(edge);
    });

    // Car
    const carGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 3),
      new THREE.MeshStandardMaterial({ color: accentColor || "#3ee6e0" })
    );
    body.position.y = 0.5;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.45, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x12092b })
    );
    cabin.position.set(0, 0.9, -0.2);
    carGroup.add(body, cabin);
    scene.add(carGroup);

    // Boost pads
    const boostGroup = new THREE.Group();
    const boostPads = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffb703, emissiveIntensity: 0.5 })
      );
      pad.position.set(Math.cos(angle) * TRACK_RADIUS, 0.6, Math.sin(angle) * TRACK_RADIUS);
      pad.userData.angle = angle;
      pad.userData.taken = false;
      boostGroup.add(pad);
      boostPads.push(pad);
    }
    scene.add(boostGroup);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 10);
    scene.add(dirLight);

    sceneRef.current = { renderer, scene, camera, carGroup, boostPads, width, height };

    function handleResize() {
      if (!mountRef.current || !sceneRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);
    resizeHandlerRef.current = handleResize;

    function animate() {
      const s = stateRef.current;

      // steering moves radiusOffset gradually
      s.radiusOffset += s.steerInput * 0.025;
      s.radiusOffset = Math.max(-1, Math.min(1, s.radiusOffset));

      const nearEdge = Math.abs(s.radiusOffset) > 0.85;
      setOffTrack(nearEdge);

      let currentSpeed = s.speed;
      if (nearEdge) currentSpeed *= 0.4;
      if (s.boostTimer > 0) {
        currentSpeed *= 1.9;
        s.boostTimer -= 1;
      }

      s.theta += currentSpeed;
      const currentRadius = TRACK_RADIUS + s.radiusOffset * (TRACK_WIDTH / 2 - 0.8);

      const x = Math.cos(s.theta) * currentRadius;
      const z = Math.sin(s.theta) * currentRadius;
      const carX = sceneRef.current.carGroup.position.x;
      const carZ = sceneRef.current.carGroup.position.z;
      const dx = x - carX;
      const dz = z - carZ;
      sceneRef.current.carGroup.position.set(x, 0, z);
      sceneRef.current.carGroup.rotation.y = Math.atan2(dx, dz);

      s.distanceScore += currentSpeed * currentRadius * 0.6;

      // boost pad collection
      for (const pad of sceneRef.current.boostPads) {
        if (pad.userData.taken) continue;
        const px = Math.cos(pad.userData.angle) * TRACK_RADIUS;
        const pz = Math.sin(pad.userData.angle) * TRACK_RADIUS;
        const dist = Math.hypot(px - x, pz - z);
        if (dist < 2.4) {
          pad.userData.taken = true;
          pad.visible = false;
          s.boostTimer = 55;
          s.boosts += 1;
          setBoosts(s.boosts);
          sfx.boost();
        }
      }

      // camera chase
      const camDist = 8;
      const behindAngle = s.theta - currentSpeed * 6;
      const camX = Math.cos(behindAngle) * (currentRadius - camDist * 0.3);
      const camZ = Math.sin(behindAngle) * (currentRadius - camDist * 0.3);
      sceneRef.current.camera.position.set(camX, 4.5, camZ);
      sceneRef.current.camera.lookAt(x, 1, z);

      sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowLeft") stateRef.current.steerInput = -1;
      if (e.key === "ArrowRight") stateRef.current.steerInput = 1;
    }
    function handleKeyUp(e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") stateRef.current.steerInput = 0;
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (resizeHandlerRef.current) window.removeEventListener("resize", resizeHandlerRef.current);
      if (sceneRef.current) {
        const { renderer, scene } = sceneRef.current;
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  function setSteer(value) {
    stateRef.current.steerInput = value;
  }

  if (!supported) {
    return (
      <p className="text-center text-textDim">
        Your browser doesn't support 3D graphics (WebGL). Try a different browser or device.
      </p>
    );
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          A real 3D track — steer left and right (arrow keys or the buttons below) to stay on the road, grab glowing
          boost orbs, and rack up distance in 60 seconds. Drift too close to the edge and you'll slow down.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START ENGINE ▸
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>⚡ Boosts: <span className="text-textLight">{boosts}</span></span>
        <span style={{ color: offTrack ? "#ff3ea5" : timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>
          {offTrack ? "OFF TRACK!" : `Time left: ${timeLeft}s`}
        </span>
      </div>
      <div
        ref={mountRef}
        className="mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(92vw, 420px)", height: 280, background: "#12092b" }}
      />
      <div className="flex justify-center gap-4 mt-4">
        <button
          onMouseDown={() => setSteer(-1)}
          onMouseUp={() => setSteer(0)}
          onMouseLeave={() => setSteer(0)}
          onTouchStart={() => setSteer(-1)}
          onTouchEnd={() => setSteer(0)}
          className="px-8 py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ◀
        </button>
        <button
          onMouseDown={() => setSteer(1)}
          onMouseUp={() => setSteer(0)}
          onMouseLeave={() => setSteer(0)}
          onTouchStart={() => setSteer(1)}
          onTouchEnd={() => setSteer(0)}
          className="px-8 py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
