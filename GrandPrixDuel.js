"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createClient } from "@/lib/supabaseClient";
import { buildTrackCurve, buildTrackGeometry, buildCar, buildPylon, trackPointAt, TRACK_WIDTH } from "@/lib/raceTrack";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const BASE_SPEED = 0.00075;
const BROADCAST_INTERVAL_MS = 150;

export default function GrandPrixDuel({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | searching | racing | finished
  const [supported, setSupported] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [boosts, setBoosts] = useState(0);
  const [lap, setLap] = useState(1);
  const [ahead, setAhead] = useState(null);
  const [log, setLog] = useState("");

  const supabaseRef = useRef(null);
  const duelIdRef = useRef(null);
  const raceChannelRef = useRef(null);
  const stateRef = useRef({
    t: 0,
    lateralOffset: 0,
    speed: BASE_SPEED,
    boostTimer: 0,
    boosts: 0,
    totalProgress: 0,
    steerInput: 0,
  });
  const opponentRef = useRef({ t: 0.01, lateralOffset: 0, totalProgress: 0, seen: false });
  const timerRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const finishedRef = useRef(false);
  const frameRef = useRef(null);
  const isVsAIRef = useRef(false);

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
    startRaceVsAI();
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

  function startRaceVsAI() {
    isVsAIRef.current = true;
    opponentRef.current = { t: 0.01, lateralOffset: 0, totalProgress: 0, seen: false };
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
    sfx.lose();
    const score = Math.round(stateRef.current.totalProgress * 900) + stateRef.current.boosts * 40;
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

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x160c33 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const curve = buildTrackCurve();
    const track = new THREE.Mesh(buildTrackGeometry(curve), new THREE.MeshStandardMaterial({ color: 0x241154, roughness: 0.9 }));
    scene.add(track);

    const edgeColor = accentColor || "#3ee6e0";
    const EDGE_SEGMENTS = 140;
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

    const PYLON_COUNT = 24;
    for (let i = 0; i < PYLON_COUNT; i++) {
      const { point, side } = trackPointAt(curve, i / PYLON_COUNT);
      const pylon = buildPylon();
      const pos = point.clone().addScaledVector(side, TRACK_WIDTH / 2 + 1.6);
      pylon.position.set(pos.x, 0, pos.z);
      scene.add(pylon);
    }

    const myCar = buildCar(accentColor || "#3ee6e0");
    const opponentCar = buildCar("#ff3ea5");
    scene.add(myCar, opponentCar);

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

      if (isVsAIRef.current) {
        const bot = opponentRef.current;
        const wobble = Math.sin(performance.now() / 850) * 0.5;
        const botSpeed = BASE_SPEED * 1.04;
        bot.lateralOffset = Math.max(-0.7, Math.min(0.7, (bot.lateralOffset || 0) + wobble * 0.012));
        bot.t = (bot.t || 0.01) + botSpeed;
        bot.totalProgress = (bot.totalProgress || 0) + botSpeed;
        bot.seen = true;
      }

      s.lateralOffset += s.steerInput * 0.028;
      s.lateralOffset = Math.max(-1, Math.min(1, s.lateralOffset));
      const nearEdge = Math.abs(s.lateralOffset) > 0.85;

      let currentSpeed = s.speed;
      if (nearEdge) currentSpeed *= 0.4;
      if (s.boostTimer > 0) {
        currentSpeed *= 1.9;
        s.boostTimer -= 1;
      }

      s.t += currentSpeed;
      s.totalProgress += currentSpeed;
      setLap(Math.floor(s.totalProgress) + 1);

      const { point, tangent, side } = trackPointAt(curve, s.t);
      const carPos = point.clone().addScaledVector(side, s.lateralOffset * (TRACK_WIDTH / 2 - 0.9));
      myCar.position.set(carPos.x, 0, carPos.z);
      myCar.rotation.y = Math.atan2(tangent.x, tangent.z);

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

      const opp = opponentRef.current;
      if (opp.seen) {
        const oInfo = trackPointAt(curve, opp.t);
        const oPos = oInfo.point.clone().addScaledVector(oInfo.side, (opp.lateralOffset || 0) * (TRACK_WIDTH / 2 - 0.9));
        opponentCar.position.lerp(new THREE.Vector3(oPos.x, 0, oPos.z), 0.3);
        opponentCar.rotation.y = Math.atan2(oInfo.tangent.x, oInfo.tangent.z);
        setAhead(s.totalProgress >= opp.totalProgress);
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

    broadcastTimerRef.current = setInterval(() => {
      if (raceChannelRef.current && !isVsAIRef.current) {
        raceChannelRef.current.send({
          type: "broadcast",
          event: "pos",
          payload: {
            t: stateRef.current.t,
            lateralOffset: stateRef.current.lateralOffset,
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

  if (phase === "idle") {
    return (
      <div className="text-center">
        <h2 className="font-pixel text-[11px] mb-4 text-accentAmber">HOW TO PLAY</h2>
        <div className="text-left max-w-xs mx-auto mb-6 space-y-2 text-sm text-textDim">
          <p>🏁 Race a real opponent live, or the computer if no one's around.</p>
          <p>🏎️ Your car accelerates on its own — you only steer.</p>
          <p>◀ ▶ Arrow keys, or the on-screen buttons, to steer left/right.</p>
          <p>🛣️ Stay between the glowing dashed lines, or you'll slow down.</p>
          <p>⚡ Drive through gold orbs for a speed boost. Cover more distance than your opponent in 60 seconds.</p>
        </div>
        {log && <p className="text-accentMagenta text-xs mb-4">{log}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={findMatch} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            FIND OPPONENT ▸
          </button>
          <button onClick={startRaceVsAI} className="font-mono text-[10px] px-5 py-3 rounded-md border border-lineColor text-textLight">
            Race vs AI instead
          </button>
        </div>
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
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Lap <span className="text-textLight">{lap}</span></span>
        <span>⚡ <span className="text-textLight">{boosts}</span></span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>{timeLeft}s</span>
      </div>
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
