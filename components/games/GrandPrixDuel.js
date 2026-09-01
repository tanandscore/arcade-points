"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createClient } from "@/lib/supabaseClient";
import {
  buildTrackCurve,
  buildTrackGeometry,
  buildCar,
  buildPylon,
  buildTree,
  buildGravelPatch,
  buildGrandstand,
  buildDistantHills,
  buildFinishArch,
  trackPointAt,
  trackCurvatureAt,
  sampleTrackPoints,
  findNearestTrackPoint,
  findSharpCornerSpots,
  TRACK_WIDTH,
} from "@/lib/raceTrack";
import { sfx, createEngineSound } from "@/lib/sound";

const DURATION = 60;
const MIN_SPEED = 0.09;
const MAX_SPEED = 0.42;
const START_SPEED = 0.16;
const ACCEL_RATE = 0.008;
const BRAKE_RATE = 0.02;
const FRICTION = 0.0035;
const CORNER_STRESS_LIMIT = 2.1;
const OFF_TRACK_MARGIN = TRACK_WIDTH / 2 - 0.1;
const BROADCAST_INTERVAL_MS = 150;
const AI_DIFFICULTY = {
  1: { label: "CADET", mult: 1, topSpeedMult: 0.5, cornerSpeedMult: 1.15, smoothing: 0.02 },
  2: { label: "ROOKIE", mult: 1.2, topSpeedMult: 0.62, cornerSpeedMult: 1.25, smoothing: 0.025 },
  3: { label: "AMATEUR", mult: 1.45, topSpeedMult: 0.76, cornerSpeedMult: 1.35, smoothing: 0.033 },
  4: { label: "PRO", mult: 1.75, topSpeedMult: 0.9, cornerSpeedMult: 1.45, smoothing: 0.045 },
  5: { label: "CHAMPION", mult: 2.1, topSpeedMult: 1.0, cornerSpeedMult: 1.5, smoothing: 0.053 },
  6: { label: "LEGEND", mult: 2.5, topSpeedMult: 1.08, cornerSpeedMult: 1.6, smoothing: 0.065 },
};

export default function GrandPrixDuel({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | searching | ai-select | racing | finished
  const [aiLevel, setAiLevel] = useState(1);
  const [supported, setSupported] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [boosts, setBoosts] = useState(0);
  const [lap, setLap] = useState(1);
  const [ahead, setAhead] = useState(null);
  const [log, setLog] = useState("");
  const [speedPct, setSpeedPct] = useState(0);
  const [warnCorner, setWarnCorner] = useState(false);

  const aiLevelRef = useRef(1);
  const supabaseRef = useRef(null);
  const duelIdRef = useRef(null);
  const raceChannelRef = useRef(null);
  const stateRef = useRef({
    x: 0,
    z: 0,
    heading: 0,
    speed: START_SPEED,
    boostTimer: 0,
    boosts: 0,
    totalProgress: 0,
    lastT: 0,
    steerInput: 0,
    throttleInput: 0,
  });
  const opponentRef = useRef({ x: 0, z: 0, heading: 0, totalProgress: 0, seen: false });
  const botTRef = useRef({ t: 0.01, speed: START_SPEED });
  const timerRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const finishedRef = useRef(false);
  const frameRef = useRef(null);
  const isVsAIRef = useRef(false);
  const engineRef = useRef(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  async function findMatch() {
    setPhase("searching");
    setLog("");
    const res = await fetch("/api/duels/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_slug: "grandprixduel" }),
    });
    const data = await res.json();
    if (!data.duelId) {
      setLog(data.error || "Couldn't find a match.");
      setPhase("idle");
      return;
    }
    duelIdRef.current = data.duelId;

    const { data: row } = await supabase.from("duels").select("*").eq("id", data.duelId).single();
    if (row.status === "active") {
      startRace();
    } else {
      supabase
        .channel(`duel-${data.duelId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${data.duelId}` },
          (payload) => {
            if (payload.new.status === "active") startRace();
          }
        )
        .subscribe();
    }
  }

  async function cancelSearch() {
    if (duelIdRef.current) {
      await fetch(`/api/duels/${duelIdRef.current}/cancel`, { method: "POST" });
    }
    duelIdRef.current = null;
    setPhase("idle");
  }

  async function switchToAI() {
    if (duelIdRef.current) {
      await fetch(`/api/duels/${duelIdRef.current}/cancel`, { method: "POST" });
    }
    duelIdRef.current = null;
    setPhase("ai-select");
  }

  function startRace() {
    isVsAIRef.current = false;
    sfx.select();
    setPhase("racing");

    const channel = supabase.channel(`race-${duelIdRef.current}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      opponentRef.current = { ...payload, seen: true };
    });
    channel.subscribe();
    raceChannelRef.current = channel;
  }

  function startRaceVsAI(chosenLevel) {
    aiLevelRef.current = chosenLevel;
    setAiLevel(chosenLevel);
    isVsAIRef.current = true;
    botTRef.current = { t: 0.01, speed: START_SPEED };
    opponentRef.current = { x: 0, z: 0, heading: 0, totalProgress: 0, seen: false };
    sfx.select();
    setPhase("racing");
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    clearInterval(broadcastTimerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (raceChannelRef.current) supabase.removeChannel(raceChannelRef.current);
    engineRef.current?.stop();
    sfx.lose();
    const rawScore = Math.round(stateRef.current.totalProgress * 900) + stateRef.current.boosts * 40;
    const mult = isVsAIRef.current ? AI_DIFFICULTY[aiLevelRef.current].mult : 1;
    const score = Math.round(rawScore * mult);
    setPhase("finished");
    setTimeout(() => onFinish(Math.max(0, score)), 900);
  }

  useEffect(() => {
    if (phase !== "racing" || !mountRef.current) return undefined;

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

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x1a3a24 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    scene.add(buildDistantHills());

    const curve = buildTrackCurve();
    const trackSamples = sampleTrackPoints(curve, 300);
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

    const TREE_COUNT = 28;
    for (let i = 0; i < TREE_COUNT; i++) {
      const { point, side } = trackPointAt(curve, i / TREE_COUNT + 0.02);
      const dir = i % 2 === 0 ? 1 : -1;
      const dist = TRACK_WIDTH / 2 + 4 + Math.random() * 5;
      const tree = buildTree();
      const pos = point.clone().addScaledVector(side, dir * dist);
      tree.position.set(pos.x, 0, pos.z);
      scene.add(tree);
    }

    findSharpCornerSpots(curve, 6).forEach((t) => {
      const { point, side } = trackPointAt(curve, t);
      [1, -1].forEach((dir) => {
        const patch = buildGravelPatch();
        const pos = point.clone().addScaledVector(side, dir * (TRACK_WIDTH / 2 + 2));
        patch.position.set(pos.x, 0, pos.z);
        scene.add(patch);
      });
    });

    [0.02, 0.62].forEach((tPos) => {
      const { point, tangent, side } = trackPointAt(curve, tPos);
      const stand = buildGrandstand(accentColor || "#3ee6e0");
      const pos = point.clone().addScaledVector(side, TRACK_WIDTH / 2 + 3);
      stand.position.set(pos.x, 0, pos.z);
      stand.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
      scene.add(stand);
    });

    const myCar = buildCar(accentColor || "#3ee6e0");
    const opponentCar = buildCar("#ff3ea5");
    scene.add(myCar, opponentCar);

    const startInfo = trackPointAt(curve, 0);
    stateRef.current.x = startInfo.point.x;
    stateRef.current.z = startInfo.point.z;
    stateRef.current.heading = Math.atan2(startInfo.tangent.x, startInfo.tangent.z);
    opponentCar.position.set(startInfo.point.x, 0, startInfo.point.z);

    const arch = buildFinishArch(accentColor || "#3ee6e0");
    arch.position.set(startInfo.point.x, 0, startInfo.point.z);
    arch.rotation.y = Math.atan2(startInfo.tangent.x, startInfo.tangent.z);
    scene.add(arch);

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(25, 35, 15);
    scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(accentColor || "#3ee6e0", 0.25);
    rimLight.position.set(-20, 10, -20);
    scene.add(rimLight);

    const camPos = new THREE.Vector3(0, 6, 10);
    const camTarget = new THREE.Vector3();
    let cameraInitialized = false;

    const engine = createEngineSound();
    engineRef.current = engine;

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

      if (isVsAIRef.current) {
        const bot = botTRef.current;
        const aiDiff = AI_DIFFICULTY[aiLevelRef.current];
        const curvatureAhead = trackCurvatureAt(curve, bot.t + 0.015);
        const desiredSpeed = curvatureAhead > 1.0 ? MIN_SPEED * aiDiff.cornerSpeedMult : MAX_SPEED * aiDiff.topSpeedMult;
        bot.speed = bot.speed + (desiredSpeed - bot.speed) * aiDiff.smoothing;
        bot.t += bot.speed * 0.01;
        const botInfo = trackPointAt(curve, bot.t);
        opponentRef.current = {
          x: botInfo.point.x,
          z: botInfo.point.z,
          heading: Math.atan2(botInfo.tangent.x, botInfo.tangent.z),
          totalProgress: bot.t,
          seen: true,
        };
      }

      if (s.throttleInput > 0) {
        s.speed = Math.min(MAX_SPEED, s.speed + ACCEL_RATE);
      } else if (s.throttleInput < 0) {
        s.speed = Math.max(MIN_SPEED, s.speed - BRAKE_RATE);
      } else {
        s.speed = Math.max(MIN_SPEED, s.speed - FRICTION);
      }
      const speedRatio = (s.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
      setSpeedPct(Math.round(speedRatio * 100));
      engine.update(speedRatio, s.throttleInput > 0 ? "accel" : s.throttleInput < 0 ? "brake" : "coast");

      const turnRate = 0.082 - speedRatio * 0.012;
      s.heading += s.steerInput * turnRate;

      const nearest = findNearestTrackPoint(trackSamples, s.x, s.z);
      const isOffTrack = nearest.distance > OFF_TRACK_MARGIN;

      let moveSpeed = s.speed;
      if (isOffTrack) moveSpeed *= 0.72;
      if (s.boostTimer > 0) {
        moveSpeed *= 1.9;
        s.boostTimer -= 1;
      }

      const curvatureHere = trackCurvatureAt(curve, nearest.t);
      const curvatureAheadMe = trackCurvatureAt(curve, nearest.t + 0.012);
      setWarnCorner(curvatureAheadMe > 1.0 && s.speed > MAX_SPEED * 0.6);
      const cornerStress = curvatureHere * s.speed * 1200;
      if (cornerStress > CORNER_STRESS_LIMIT) {
        moveSpeed *= 0.85;
      }

      s.x += Math.sin(s.heading) * moveSpeed;
      s.z += Math.cos(s.heading) * moveSpeed;

      let deltaT = nearest.t - s.lastT;
      if (deltaT < -0.5) deltaT += 1;
      else if (deltaT > 0.5) deltaT -= 1;
      if (Math.abs(deltaT) < 0.25) s.totalProgress += deltaT;
      s.lastT = nearest.t;
      setLap(Math.max(1, Math.floor(s.totalProgress) + 1));

      myCar.position.set(s.x, 0, s.z);
      myCar.rotation.y = s.heading;

      for (const pad of boostPads) {
        if (pad.userData.taken) continue;
        const dist = pad.position.distanceTo(new THREE.Vector3(s.x, pad.position.y, s.z));
        if (dist < 2.5) {
          pad.userData.taken = true;
          pad.visible = false;
          s.boostTimer = 55;
          s.boosts += 1;
          setBoosts(s.boosts);
          sfx.boost();
        }
      }

      const opp = opponentRef.current;
      if (opp.seen) {
        opponentCar.position.lerp(new THREE.Vector3(opp.x, 0, opp.z), 0.3);
        opponentCar.rotation.y = opp.heading;
        setAhead(s.totalProgress >= opp.totalProgress);
      }

      const forward = new THREE.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
      const carPos = new THREE.Vector3(s.x, 0, s.z);
      const desiredCamPos = carPos.clone().addScaledVector(forward, -7.5).add(new THREE.Vector3(0, 4.2, 0));
      const desiredLookAt = carPos.clone().addScaledVector(forward, 6).add(new THREE.Vector3(0, 0.6, 0));
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

    broadcastTimerRef.current = setInterval(() => {
      if (raceChannelRef.current && !isVsAIRef.current) {
        raceChannelRef.current.send({
          type: "broadcast",
          event: "pos",
          payload: {
            x: stateRef.current.x,
            z: stateRef.current.z,
            heading: stateRef.current.heading,
            totalProgress: stateRef.current.totalProgress,
          },
        });
      }
    }, BROADCAST_INTERVAL_MS);

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
      clearInterval(broadcastTimerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      engine.stop();
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
  }, [phase]);

  useEffect(() => {
    function handleKey(e) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
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

  if (phase === "idle") {
    return (
      <div className="text-center">
        <h2 className="font-pixel text-[11px] mb-4 text-accentAmber">HOW TO PLAY</h2>
        <div className="text-left max-w-xs mx-auto mb-6 space-y-2 text-sm text-textDim">
          <p>🏁 Race a real opponent live, or the computer if no one's around.</p>
          <p>🏎️ You control both speed and steering — if you don't turn, you drive straight, not along the track.</p>
          <p>▲ Accelerate, ▼ Brake, ◀ ▶ Steer — arrow keys or the on-screen controls.</p>
          <p>🛣️ A real circuit with a chicane and a tight hairpin — drift onto the grass or gravel and you'll lose time.</p>
          <p>⚡ Grab gold orbs for a boost. Cover more distance than your opponent in 60 seconds.</p>
        </div>
        {log && <p className="text-accentMagenta text-xs mb-4">{log}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={findMatch} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            FIND OPPONENT ▸
          </button>
          <button onClick={() => setPhase("ai-select")} className="font-mono text-[10px] px-5 py-3 rounded-md border border-lineColor text-textLight">
            Race vs AI instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ai-select") {
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber mb-2">CHOOSE YOUR RIVAL</p>
        <p className="font-mono text-[10px] text-textDim mb-5">Tougher AI scores more per point.</p>
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <button
              key={lvl}
              onClick={() => startRaceVsAI(lvl)}
              className="px-3 py-2.5 rounded-md border font-pixel text-[9px]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              LVL {lvl}
              <div className="text-[7px] text-textDim mt-1">{AI_DIFFICULTY[lvl].label} ×{AI_DIFFICULTY[lvl].mult}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setPhase("idle")} className="font-mono text-[10px] text-textDim underline mt-5">
          ← Back
        </button>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber ap-blink mb-3">SEARCHING FOR OPPONENT...</p>
        <p className="text-textDim text-xs mb-5">This fills the moment another racer queues up.</p>
        <div className="flex justify-center gap-3">
          <button onClick={cancelSearch} className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textDim">
            Cancel search
          </button>
          <button onClick={switchToAI} className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textLight">
            Race vs AI instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-2 text-textDim">
        <span>Lap <span className="text-textLight">{lap}</span>{isVsAIRef.current && ` · Lvl ${aiLevel}`}</span>
        <span>⚡ <span className="text-textLight">{boosts}</span></span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>{timeLeft}s</span>
      </div>
      <div className="flex items-center gap-2 mb-2 max-w-[200px] mx-auto">
        <span className="font-mono text-[9px] text-textDim">SPEED</span>
        <div className="flex-1 h-2 rounded-full bg-bgPanel3 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${speedPct}%`, background: warnCorner ? "#ff3ea5" : accentColor }}
          />
        </div>
      </div>
      {warnCorner && <p className="font-mono text-[10px] text-accentMagenta mb-1 ap-blink">⚠️ Sharp corner ahead — brake and steer!</p>}
      {ahead !== null && (
        <p className="font-mono text-[11px] mb-2" style={{ color: ahead ? "#16c784" : "#ff3ea5" }}>
          {ahead ? "🔼 You're ahead" : "🔽 Opponent is ahead"}
        </p>
      )}
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
