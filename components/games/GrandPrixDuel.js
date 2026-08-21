"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createClient } from "@/lib/supabaseClient";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const TRACK_RADIUS = 30;
const TRACK_WIDTH = 10;
const LAP_SPEED_BASE = 0.014;
const BROADCAST_INTERVAL_MS = 150;

export default function GrandPrixDuel({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | searching | racing | finished
  const [supported, setSupported] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [boosts, setBoosts] = useState(0);
  const [ahead, setAhead] = useState(null);
  const [log, setLog] = useState("");

  const supabaseRef = useRef(null);
  const duelIdRef = useRef(null);
  const raceChannelRef = useRef(null);
  const sceneRef = useRef(null);
  const stateRef = useRef({
    theta: 0,
    radiusOffset: 0,
    speed: LAP_SPEED_BASE,
    boostTimer: 0,
    boosts: 0,
    distanceScore: 0,
    steerInput: 0,
  });
  const opponentRef = useRef({ theta: 0.05, radiusOffset: 0, distanceScore: 0, seen: false });
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

  // Used by "Race vs AI instead" while mid-search — awaits the cancel
  // completing before switching modes, so the cancel's own cleanup
  // can't fire after and reset us out of AI mode.
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

    // Live position channel — pure pub/sub relay, no database writes,
    // which is what makes ~150ms position updates practical without
    // hammering Postgres.
    const channel = supabase.channel(`race-${duelIdRef.current}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      opponentRef.current = { ...payload, seen: true };
    });
    channel.subscribe();
    raceChannelRef.current = channel;
  }

  function startRaceVsAI() {
    isVsAIRef.current = true;
    opponentRef.current = { theta: 0.05, radiusOffset: 0, distanceScore: 0, seen: false };
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
    const score = Math.round(stateRef.current.distanceScore) + stateRef.current.boosts * 40;
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
    scene.background = new THREE.Color(0x12092b);
    scene.fog = new THREE.Fog(0x12092b, 40, 130);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 500);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1a0f38 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(TRACK_RADIUS, TRACK_WIDTH / 2, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0x241154 })
    );
    track.rotation.x = Math.PI / 2;
    scene.add(track);

    const edgeMat = new THREE.MeshBasicMaterial({ color: accentColor || "#3ee6e0" });
    [TRACK_RADIUS - TRACK_WIDTH / 2, TRACK_RADIUS + TRACK_WIDTH / 2].forEach((r) => {
      const edge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.15, 8, 100), edgeMat);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = 0.05;
      scene.add(edge);
    });

    function makeCar(color) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 3), new THREE.MeshStandardMaterial({ color }));
      body.position.y = 0.5;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1.3), new THREE.MeshStandardMaterial({ color: 0x12092b }));
      cabin.position.set(0, 0.9, -0.2);
      group.add(body, cabin);
      return group;
    }
    const myCar = makeCar(accentColor || "#3ee6e0");
    const opponentCar = makeCar(0xff3ea5);
    scene.add(myCar, opponentCar);

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
      scene.add(pad);
      boostPads.push(pad);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 10);
    scene.add(dirLight);

    sceneRef.current = { renderer, scene, camera, myCar, opponentCar, boostPads };

    function handleResize() {
      if (!mountRef.current || !sceneRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    function animate() {
      const s = stateRef.current;

      // In AI mode, drive the opponent's ghost locally instead of
      // waiting on broadcast messages that will never arrive — same
      // "seen" flag and shape the real multiplayer path uses, so
      // rendering below doesn't need to know which mode it's in.
      if (isVsAIRef.current) {
        const bot = opponentRef.current;
        const wobble = Math.sin(performance.now() / 900) * 0.55;
        const botSpeed = LAP_SPEED_BASE * 1.05;
        bot.radiusOffset = Math.max(-0.7, Math.min(0.7, (bot.radiusOffset || 0) + wobble * 0.01));
        bot.theta = (bot.theta || 0.05) + botSpeed;
        bot.distanceScore = (bot.distanceScore || 0) + botSpeed * TRACK_RADIUS * 0.6;
        bot.seen = true;
      }

      s.radiusOffset += s.steerInput * 0.025;
      s.radiusOffset = Math.max(-1, Math.min(1, s.radiusOffset));
      const nearEdge = Math.abs(s.radiusOffset) > 0.85;

      let currentSpeed = s.speed;
      if (nearEdge) currentSpeed *= 0.4;
      if (s.boostTimer > 0) {
        currentSpeed *= 1.9;
        s.boostTimer -= 1;
      }

      s.theta += currentSpeed;
      const myRadius = TRACK_RADIUS + s.radiusOffset * (TRACK_WIDTH / 2 - 0.8);
      const mx = Math.cos(s.theta) * myRadius;
      const mz = Math.sin(s.theta) * myRadius;
      const dx = mx - myCar.position.x;
      const dz = mz - myCar.position.z;
      myCar.position.set(mx, 0, mz);
      myCar.rotation.y = Math.atan2(dx, dz);

      s.distanceScore += currentSpeed * myRadius * 0.6;

      for (const pad of boostPads) {
        if (pad.userData.taken) continue;
        const px = Math.cos(pad.userData.angle) * TRACK_RADIUS;
        const pz = Math.sin(pad.userData.angle) * TRACK_RADIUS;
        if (Math.hypot(px - mx, pz - mz) < 2.4) {
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
        const oRadius = TRACK_RADIUS + opp.radiusOffset * (TRACK_WIDTH / 2 - 0.8);
        const ox = Math.cos(opp.theta) * oRadius;
        const oz = Math.sin(opp.theta) * oRadius;
        opponentCar.position.lerp(new THREE.Vector3(ox, 0, oz), 0.25);
        setAhead(s.distanceScore >= opp.distanceScore);
      }

      const camDist = 8;
      const behindAngle = s.theta - currentSpeed * 6;
      const camX = Math.cos(behindAngle) * (myRadius - camDist * 0.3);
      const camZ = Math.sin(behindAngle) * (myRadius - camDist * 0.3);
      camera.position.set(camX, 4.5, camZ);
      camera.lookAt(mx, 1, mz);

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
            theta: stateRef.current.theta,
            radiusOffset: stateRef.current.radiusOffset,
            distanceScore: stateRef.current.distanceScore,
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
        <p className="mb-6 text-textDim">
          Race a real opponent live, or race the computer instantly if no one's around. Steer to stay on track, grab
          boosts, and see who covers more distance in 60 seconds.
        </p>
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
          <button
            onClick={switchToAI}
            className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textLight"
          >
            Race vs AI instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>⚡ Boosts: <span className="text-textLight">{boosts}</span></span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      {ahead !== null && (
        <p className="font-mono text-[11px] mb-2" style={{ color: ahead ? "#16c784" : "#ff3ea5" }}>
          {ahead ? "🔼 You're ahead" : "🔽 Opponent is ahead"}
        </p>
      )}
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
