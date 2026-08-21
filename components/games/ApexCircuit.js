"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildTrackCurve,
  buildTrackGeometry,
  buildCar,
  buildPylon,
  buildGrandstand,
  trackPointAt,
  trackCurvatureAt,
  TRACK_WIDTH,
} from "@/lib/raceTrack";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const MIN_SPEED = 0.00028;
const MAX_SPEED = 0.00145;
const START_SPEED = 0.0007;
const ACCEL_RATE = 0.000035;
const BRAKE_RATE = 0.00008;
const FRICTION = 0.00001;
const CORNER_STRESS_LIMIT = 1.4;

export default function ApexCircuit({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [supported, setSupported] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [boosts, setBoosts] = useState(0);
  const [lap, setLap] = useState(1);
  const [offTrack, setOffTrack] = useState(false);
  const [speedPct, setSpeedPct] = useState(0);
  const [warnCorner, setWarnCorner] = useState(false);

  const stateRef = useRef({
    t: 0,
    lateralOffset: 0,
    speed: START_SPEED,
    boostTimer: 0,
    boosts: 0,
    totalProgress: 0,
    steerInput: 0,
    throttleInput: 0, // 1 = accelerate, -1 = brake, 0 = coast
  });
  const timerRef = useRef(null);
  const finishedRef = useRef(false);
  const frameRef = useRef(null);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    sfx.lose();
    const score = Math.round(stateRef.current.totalProgress * 900) + stateRef.current.boosts * 40;
    onFinish(Math.max(0, score));
  }

  useEffect(() => {
    if (!started || !mountRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setSupported(false);
      return undefined;
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0720);
    scene.fog = new THREE.Fog(0x0d0720, 55, 160);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 500);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x160c33 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const curve = buildTrackCurve();
    const track = new THREE.Mesh(buildTrackGeometry(curve), new THREE.MeshStandardMaterial({ color: 0x241154, roughness: 0.9 }));
    scene.add(track);

    const edgeColor = accentColor || "#3ee6e0";
    const EDGE_SEGMENTS = 160;
    for (let i = 0; i < EDGE_SEGMENTS; i += 2) {
      const { point, tangent, side } = trackPointAt(curve, i / EDGE_SEGMENTS);
      [1, -1].forEach((dir) => {
        const mark = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.08, 1.1),
          new THREE.MeshBasicMaterial({ color: edgeColor })
        );
        const pos = point.clone().addScaledVector(side, dir * (TRACK_WIDTH / 2));
        mark.position.set(pos.x, 0.05, pos.z);
        mark.rotation.y = Math.atan2(tangent.x, tangent.z);
        scene.add(mark);
      });
    }

    const PYLON_COUNT = 26;
    for (let i = 0; i < PYLON_COUNT; i++) {
      const { point, side } = trackPointAt(curve, i / PYLON_COUNT);
      const pylon = buildPylon();
      const pos = point.clone().addScaledVector(side, TRACK_WIDTH / 2 + 1.6);
      pylon.position.set(pos.x, 0, pos.z);
      scene.add(pylon);
    }

    // Grandstands at the start/finish straight and the back straight
    [0.02, 0.62].forEach((tPos) => {
      const { point, tangent, side } = trackPointAt(curve, tPos);
      const stand = buildGrandstand(accentColor || "#3ee6e0");
      const pos = point.clone().addScaledVector(side, TRACK_WIDTH / 2 + 3);
      stand.position.set(pos.x, 0, pos.z);
      stand.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
      scene.add(stand);
    });

    const car = buildCar(accentColor || "#3ee6e0");
    scene.add(car);

    const boostPads = [];
    const BOOST_COUNT = 8;
    for (let i = 0; i < BOOST_COUNT; i++) {
      const tPos = (i + 0.5) / BOOST_COUNT;
      const { point } = trackPointAt(curve, tPos);
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffb703, emissiveIntensity: 0.5 })
      );
      pad.position.set(point.x, 0.6, point.z);
      pad.userData.taken = false;
      scene.add(pad);
      boostPads.push(pad);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(25, 35, 15);
    scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(accentColor || "#3ee6e0", 0.25);
    rimLight.position.set(-20, 10, -20);
    scene.add(rimLight);

    const camPos = new THREE.Vector3(0, 6, 10);
    const camTarget = new THREE.Vector3();
    let cameraInitialized = false;

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    function animate() {
      const s = stateRef.current;

      // Throttle / brake physics — this is the core of what makes it
      // a real driving game instead of an auto-pilot demo.
      if (s.throttleInput > 0) {
        s.speed = Math.min(MAX_SPEED, s.speed + ACCEL_RATE);
      } else if (s.throttleInput < 0) {
        s.speed = Math.max(MIN_SPEED, s.speed - BRAKE_RATE);
      } else {
        s.speed = Math.max(MIN_SPEED, s.speed - FRICTION);
      }
      setSpeedPct(Math.round(((s.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100));

      // Steering gets less agile the faster you're going — braking
      // before a sharp corner genuinely helps you make the turn.
      const speedRatio = (s.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
      const steerRate = 0.044 - speedRatio * 0.02;
      s.lateralOffset += s.steerInput * steerRate;
      s.lateralOffset = Math.max(-1, Math.min(1, s.lateralOffset));
      const nearEdge = Math.abs(s.lateralOffset) > 0.85;
      setOffTrack(nearEdge);

      let currentSpeed = s.speed;
      if (nearEdge) currentSpeed *= 0.4;
      if (s.boostTimer > 0) {
        currentSpeed *= 1.9;
        s.boostTimer -= 1;
      }

      // Corner risk: carrying too much speed into a sharp bend costs
      // you — a real slowdown plus a little loss of control, not just
      // a number changing quietly in the background.
      const curvatureHere = trackCurvatureAt(curve, s.t);
      const curvatureAhead = trackCurvatureAt(curve, s.t + 0.012);
      setWarnCorner(curvatureAhead > 1.0 && s.speed > MAX_SPEED * 0.6);
      const cornerStress = curvatureHere * s.speed * 1200;
      if (cornerStress > CORNER_STRESS_LIMIT) {
        currentSpeed *= 0.5;
        s.lateralOffset += (Math.random() - 0.5) * 0.06;
      }

      s.t += currentSpeed;
      s.totalProgress += currentSpeed;
      setLap(Math.floor(s.totalProgress) + 1);

      const { point, tangent, side } = trackPointAt(curve, s.t);
      const carPos = point.clone().addScaledVector(side, s.lateralOffset * (TRACK_WIDTH / 2 - 0.9));
      car.position.set(carPos.x, 0, carPos.z);
      car.rotation.y = Math.atan2(tangent.x, tangent.z);

      for (const pad of boostPads) {
        if (pad.userData.taken) continue;
        const dist = pad.position.distanceTo(new THREE.Vector3(carPos.x, pad.position.y, carPos.z));
        if (dist < 2.5) {
          pad.userData.taken = true;
          pad.visible = false;
          s.boostTimer = 55;
          s.boosts += 1;
          setBoosts(s.boosts);
          sfx.boost();
        }
      }

      const desiredCamPos = carPos.clone().addScaledVector(tangent, -7.5).add(new THREE.Vector3(0, 4.2, 0));
      const desiredLookAt = carPos.clone().addScaledVector(tangent, 6).add(new THREE.Vector3(0, 0.6, 0));
      if (!cameraInitialized) {
        camPos.copy(desiredCamPos);
        camTarget.copy(desiredLookAt);
        cameraInitialized = true;
      } else {
        camPos.lerp(desiredCamPos, 0.12);
        camTarget.lerp(desiredLookAt, 0.18);
      }
      camera.position.copy(camPos);
      camera.lookAt(camTarget);

      renderer.render(scene, camera);
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

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowLeft") stateRef.current.steerInput = -1;
      if (e.key === "ArrowRight") stateRef.current.steerInput = 1;
      if (e.key === "ArrowUp") stateRef.current.throttleInput = 1;
      if (e.key === "ArrowDown") stateRef.current.throttleInput = -1;
    }
    function handleKeyUp(e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") stateRef.current.steerInput = 0;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") stateRef.current.throttleInput = 0;
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setSteer(value) {
    stateRef.current.steerInput = value;
  }
  function setThrottle(value) {
    stateRef.current.throttleInput = value;
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
        <h2 className="font-pixel text-[11px] mb-4 text-accentAmber">HOW TO PLAY</h2>
        <div className="text-left max-w-xs mx-auto mb-6 space-y-2 text-sm text-textDim">
          <p>🏎️ You control both speed and steering — nothing happens automatically.</p>
          <p>▲ Accelerate, ▼ Brake — arrow keys or the on-screen pedals.</p>
          <p>◀ ▶ Steer left/right — arrow keys or the on-screen buttons.</p>
          <p>🌀 A real circuit: sweeping curves, a chicane, a tight hairpin, and long straights. Brake before sharp
            turns — carry too much speed into one and you'll slow down hard and lose grip.</p>
          <p>⚡ Drive through gold orbs for a boost. 60 seconds — cover as much distance as you can.</p>
        </div>
        <button onClick={() => setStarted(true)} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START ENGINE ▸
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-2 text-textDim">
        <span>Lap <span className="text-textLight">{lap}</span></span>
        <span>⚡ <span className="text-textLight">{boosts}</span></span>
        <span style={{ color: offTrack ? "#ff3ea5" : timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>
          {offTrack ? "OFF TRACK!" : `${timeLeft}s`}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3 max-w-[200px] mx-auto">
        <span className="font-mono text-[9px] text-textDim">SPEED</span>
        <div className="flex-1 h-2 rounded-full bg-bgPanel3 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${speedPct}%`, background: warnCorner ? "#ff3ea5" : accentColor }}
          />
        </div>
      </div>
      {warnCorner && <p className="font-mono text-[10px] text-accentMagenta mb-2 ap-blink">⚠️ Sharp corner ahead — brake!</p>}
      <div
        ref={mountRef}
        className="mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(92vw, 440px)", height: 300, background: "#0d0720" }}
      />
      <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto mt-4">
        <div />
        <button
          onMouseDown={() => setThrottle(1)}
          onMouseUp={() => setThrottle(0)}
          onMouseLeave={() => setThrottle(0)}
          onTouchStart={() => setThrottle(1)}
          onTouchEnd={() => setThrottle(0)}
          className="py-3 rounded-md border border-lineColor font-pixel text-[9px] select-none"
        >
          ▲ GAS
        </button>
        <div />
        <button
          onMouseDown={() => setSteer(-1)}
          onMouseUp={() => setSteer(0)}
          onMouseLeave={() => setSteer(0)}
          onTouchStart={() => setSteer(-1)}
          onTouchEnd={() => setSteer(0)}
          className="py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ◀
        </button>
        <button
          onMouseDown={() => setThrottle(-1)}
          onMouseUp={() => setThrottle(0)}
          onMouseLeave={() => setThrottle(0)}
          onTouchStart={() => setThrottle(-1)}
          onTouchEnd={() => setThrottle(0)}
          className="py-3 rounded-md border font-pixel text-[9px] select-none"
          style={{ borderColor: "#ff3ea5", color: "#ff3ea5" }}
        >
          ▼ BRAKE
        </button>
        <button
          onMouseDown={() => setSteer(1)}
          onMouseUp={() => setSteer(0)}
          onMouseLeave={() => setSteer(0)}
          onTouchStart={() => setSteer(1)}
          onTouchEnd={() => setSteer(0)}
          className="py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
