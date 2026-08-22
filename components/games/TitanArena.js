"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildFighterModel, applyPose } from "@/lib/fighterModel";
import { ROSTER, findFighter } from "@/lib/titanRoster";
import { sfx, createBattleMusic, characterPunch, characterKick, characterSpecial } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAX_HP = 100;
const ROUNDS_TO_WIN = 2;
const PUNCH_DMG = 8;
const KICK_DMG = 14;
const PUNCH_COOLDOWN = 350;
const KICK_COOLDOWN = 600;
const PUNCH_RANGE = 28;
const KICK_RANGE = 36;
const SPECIAL_RANGE = 46;
const STUN_MS = 1200;
const TICK_MS = 40;
const POISON_TICK_EVERY = 12; // ~480ms

function hex(n) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export default function TitanArena({ onFinish }) {
  const mountRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("select"); // select | fighting | finished
  const [selectedId, setSelectedId] = useState(null);
  const [opponentId, setOpponentId] = useState(null);

  const [myHp, setMyHp] = useState(MAX_HP);
  const [aiHp, setAiHp] = useState(MAX_HP);
  const [myWins, setMyWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [aiBlocking, setAiBlocking] = useState(false);
  const [log, setLog] = useState("");
  const [specialReady, setSpecialReady] = useState([true, true]);
  const [myStunned, setMyStunned] = useState(false);
  const [aiSpecialFlash, setAiSpecialFlash] = useState(false);
  const [mySpecialFlash, setMySpecialFlash] = useState(false);

  const distanceRef = useRef(70);
  const moveRef = useRef(0);
  const myHpRef = useRef(MAX_HP);
  const aiHpRef = useRef(MAX_HP);
  const myWinsRef = useRef(0);
  const aiWinsRef = useRef(0);
  const blockingRef = useRef(false);
  const aiBlockingRef = useRef(false);
  const myGuardDownRef = useRef(false);
  const aiGuardDownRef = useRef(false);
  const myStunnedUntilRef = useRef(0);
  const aiStunnedUntilRef = useRef(0);
  const myPoisonRef = useRef({ ticksLeft: 0, dmgPerTick: 0 });
  const aiPoisonRef = useRef({ ticksLeft: 0, dmgPerTick: 0 });
  const poisonCounterRef = useRef(0);
  const lastPunchRef = useRef(0);
  const lastKickRef = useRef(0);
  const specialCooldownRefs = useRef([0, 0]);
  const aiTimerRef = useRef(0);
  const aiLastSpecialRef = useRef([0, 0]);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);
  const myFighterRef = useRef(null);
  const aiFighterRef = useRef(null);
  const musicRef = useRef(null);
  const stunCheckRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  // Battle music starts the moment the arena opens (character select),
  // not just once a fight begins — plays through select, fight, and
  // results, then stops on unmount.
  useEffect(() => {
    musicRef.current = createBattleMusic();
    function handleFirstInteraction() {
      musicRef.current?.resumeIfNeeded();
      window.removeEventListener("click", handleFirstInteraction);
    }
    window.addEventListener("click", handleFirstInteraction);
    return () => {
      musicRef.current?.stop();
      window.removeEventListener("click", handleFirstInteraction);
    };
  }, []);

  // Keeps the "stunned" UI state (disables your buttons) in sync —
  // separate from the game tick since it needs to update even between
  // ticks for a responsive-feeling re-enable.
  useEffect(() => {
    stunCheckRef.current = setInterval(() => {
      setMyStunned(Date.now() < myStunnedUntilRef.current);
    }, 100);
    return () => clearInterval(stunCheckRef.current);
  }, []);

  function pickOpponent(excludeId) {
    const pool = ROSTER.filter((f) => f.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function enterFullscreenAndFight(fighterId) {
    setSelectedId(fighterId);
    setOpponentId(pickOpponent(fighterId));
    musicRef.current?.resumeIfNeeded();
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    setPhase("fighting");
  }

  function finishMatch() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const won = myWinsRef.current > aiWinsRef.current;
    sfx[won ? "newBest" : "lose"]();
    const score = myWinsRef.current * 250 + Math.round((myHpRef.current / MAX_HP) * 100);
    setPhase("finished");
    setTimeout(() => onFinish(Math.max(0, score)), 1000);
  }

  function newRound() {
    myHpRef.current = MAX_HP;
    aiHpRef.current = MAX_HP;
    setMyHp(MAX_HP);
    setAiHp(MAX_HP);
    distanceRef.current = 70;
    myGuardDownRef.current = false;
    aiGuardDownRef.current = false;
    myPoisonRef.current = { ticksLeft: 0, dmgPerTick: 0 };
    aiPoisonRef.current = { ticksLeft: 0, dmgPerTick: 0 };
  }

  function flashPose(fighterRef, pose, duration = 260) {
    if (!fighterRef.current) return;
    applyPose(fighterRef.current, pose);
    setTimeout(() => {
      if (fighterRef.current) applyPose(fighterRef.current, "idle");
    }, duration);
  }

  // Shared resolver for every special move, player- or AI-cast — one
  // switch over the 9 ability "kinds" used across the roster, instead
  // of duplicating this logic for both sides.
  function resolveSpecial(special, casterIsMe) {
    const targetBlocking = casterIsMe ? aiBlockingRef.current : blockingRef.current;
    const targetGuardDown = casterIsMe ? aiGuardDownRef.current : myGuardDownRef.current;
    const blocked = targetBlocking && !targetGuardDown;
    let dmg = 0;
    let selfHeal = 0;

    switch (special.kind) {
      case "ranged":
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        break;
      case "unblockable":
        dmg = special.damage;
        break;
      case "guardbreak":
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        if (casterIsMe) aiGuardDownRef.current = true;
        else myGuardDownRef.current = true;
        break;
      case "stun":
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        if (casterIsMe) aiStunnedUntilRef.current = Date.now() + STUN_MS;
        else myStunnedUntilRef.current = Date.now() + STUN_MS;
        break;
      case "heal":
        selfHeal = special.damage;
        break;
      case "dash":
        distanceRef.current = 12;
        dmg = special.damage;
        break;
      case "knockback":
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        distanceRef.current = 92;
        break;
      case "poison": {
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        const poisonRef = casterIsMe ? aiPoisonRef : myPoisonRef;
        poisonRef.current = { ticksLeft: 4, dmgPerTick: 4 };
        break;
      }
      case "lifesteal":
        dmg = blocked ? Math.round(special.damage * 0.35) : special.damage;
        selfHeal = Math.round(dmg / 2);
        break;
      default:
        break;
    }

    if (casterIsMe) {
      aiHpRef.current = Math.max(0, aiHpRef.current - dmg);
      setAiHp(aiHpRef.current);
      if (selfHeal) {
        myHpRef.current = Math.min(MAX_HP, myHpRef.current + selfHeal);
        setMyHp(myHpRef.current);
      }
      if (aiHpRef.current <= 0) endRound(true);
    } else {
      myHpRef.current = Math.max(0, myHpRef.current - dmg);
      setMyHp(myHpRef.current);
      if (selfHeal) {
        aiHpRef.current = Math.min(MAX_HP, aiHpRef.current + selfHeal);
        setAiHp(aiHpRef.current);
      }
      if (myHpRef.current <= 0) endRound(false);
    }
  }

  useEffect(() => {
    if (phase !== "fighting" || !mountRef.current || !selectedId) return undefined;

    const myDef = findFighter(selectedId);
    const aiDef = findFighter(opponentId);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return undefined;
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0720);
    scene.fog = new THREE.Fog(0x0d0720, 14, 34);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(0, 3.4, 9);
    camera.lookAt(0, 1.8, 0);

    const arena = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a0f3d, roughness: 0.85 })
    );
    arena.position.y = -0.2;
    scene.add(arena);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.08, 8, 48),
      new THREE.MeshStandardMaterial({ color: myDef.accent, emissive: myDef.accent, emissiveIntensity: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 10, 6);
    scene.add(key);
    const rim1 = new THREE.PointLight(myDef.accent, 1.2, 20);
    rim1.position.set(-6, 4, 2);
    scene.add(rim1);
    const rim2 = new THREE.PointLight(aiDef.accent, 1.2, 20);
    rim2.position.set(6, 4, 2);
    scene.add(rim2);

    const myFighter = buildFighterModel(myDef.color, myDef.accent);
    const aiFighter = buildFighterModel(aiDef.color, aiDef.accent);
    aiFighter.rotation.y = Math.PI;
    scene.add(myFighter, aiFighter);
    myFighterRef.current = myFighter;
    aiFighterRef.current = aiFighter;

    function updatePositions() {
      const d = distanceRef.current / 100;
      myFighter.position.x = -1.2 - d * 4.5;
      aiFighter.position.x = 1.2 + d * 4.5;
    }
    updatePositions();

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    let frameId;
    function render() {
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();

    intervalRef.current = setInterval(() => {
      distanceRef.current = Math.max(0, Math.min(100, distanceRef.current + moveRef.current * 2.2));
      updatePositions();

      // poison ticking
      poisonCounterRef.current += 1;
      if (poisonCounterRef.current > POISON_TICK_EVERY) {
        poisonCounterRef.current = 0;
        if (myPoisonRef.current.ticksLeft > 0) {
          myHpRef.current = Math.max(0, myHpRef.current - myPoisonRef.current.dmgPerTick);
          setMyHp(myHpRef.current);
          myPoisonRef.current.ticksLeft -= 1;
          if (myHpRef.current <= 0) endRound(false);
        }
        if (aiPoisonRef.current.ticksLeft > 0) {
          aiHpRef.current = Math.max(0, aiHpRef.current - aiPoisonRef.current.dmgPerTick);
          setAiHp(aiHpRef.current);
          aiPoisonRef.current.ticksLeft -= 1;
          if (aiHpRef.current <= 0) endRound(true);
        }
      }

      // AI behavior
      aiTimerRef.current += 1;
      if (aiTimerRef.current > 14) {
        aiTimerRef.current = 0;
        if (Date.now() < aiStunnedUntilRef.current) return;
        const now = Date.now();
        const readySpecials = aiDef.specials
          .map((sp, i) => ({ sp, i }))
          .filter(({ sp, i }) => now - aiLastSpecialRef.current[i] > sp.cooldown);

        if (distanceRef.current > KICK_RANGE && !aiDef.specials.some((s) => s.kind === "ranged")) {
          distanceRef.current = Math.max(0, distanceRef.current - 8);
        } else if (readySpecials.length && Math.random() < 0.3) {
          const pick = readySpecials[Math.floor(Math.random() * readySpecials.length)];
          if (pick.sp.kind !== "ranged" && distanceRef.current > SPECIAL_RANGE) {
            distanceRef.current = Math.max(0, distanceRef.current - 8);
          } else {
            aiLastSpecialRef.current[pick.i] = now;
            setAiSpecialFlash(true);
            setTimeout(() => setAiSpecialFlash(false), 500);
            flashPose(aiFighterRef, "special", 400);
            characterSpecial(aiDef.sound);
            resolveSpecial(pick.sp, false);
            setLog(`${aiDef.name} used ${pick.sp.name}!`);
          }
        } else if (Math.random() < 0.35) {
          aiBlockingRef.current = true;
          setAiBlocking(true);
          setTimeout(() => {
            aiBlockingRef.current = false;
            setAiBlocking(false);
          }, 500);
        } else if (distanceRef.current < KICK_RANGE) {
          const useKick = Math.random() < 0.5;
          flashPose(aiFighterRef, useKick ? "kick" : "punch");
          if (useKick) characterKick(aiDef.sound);
          else characterPunch(aiDef.sound);
          const dmg = useKick ? KICK_DMG : PUNCH_DMG;
          const blocked = blockingRef.current && !myGuardDownRef.current;
          myGuardDownRef.current = false;
          const actual = blocked ? Math.round(dmg * 0.35) : dmg;
          myHpRef.current = Math.max(0, myHpRef.current - actual);
          setMyHp(myHpRef.current);
          if (myHpRef.current <= 0) endRound(false);
        } else {
          distanceRef.current = Math.max(0, distanceRef.current - 6);
        }
      }
    }, TICK_MS);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
      clearInterval(intervalRef.current);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
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
  }, [phase, selectedId, opponentId]);

  function endRound(playerWon) {
    if (playerWon) {
      myWinsRef.current += 1;
      setMyWins(myWinsRef.current);
      sfx.win();
    } else {
      aiWinsRef.current += 1;
      setAiWins(aiWinsRef.current);
      sfx.wrong();
    }
    if (myWinsRef.current >= ROUNDS_TO_WIN || aiWinsRef.current >= ROUNDS_TO_WIN) {
      setLog(myWinsRef.current > aiWinsRef.current ? "VICTORY!" : "DEFEATED.");
      finishMatch();
    } else {
      setTimeout(() => {
        newRound();
        setLog(playerWon ? "Round won! Next round." : "Round lost. Next round.");
      }, 1000);
    }
  }

  function punch() {
    if (Date.now() < myStunnedUntilRef.current) return;
    const now = Date.now();
    if (now - lastPunchRef.current < PUNCH_COOLDOWN || distanceRef.current > PUNCH_RANGE) return;
    lastPunchRef.current = now;
    const myDef = findFighter(selectedId);
    flashPose(myFighterRef, "punch");
    characterPunch(myDef.sound);
    const blocked = aiBlockingRef.current && !aiGuardDownRef.current;
    aiGuardDownRef.current = false;
    const actual = blocked ? Math.round(PUNCH_DMG * 0.35) : PUNCH_DMG;
    aiHpRef.current = Math.max(0, aiHpRef.current - actual);
    setAiHp(aiHpRef.current);
    if (aiHpRef.current <= 0) endRound(true);
  }

  function kick() {
    if (Date.now() < myStunnedUntilRef.current) return;
    const now = Date.now();
    if (now - lastKickRef.current < KICK_COOLDOWN || distanceRef.current > KICK_RANGE) return;
    lastKickRef.current = now;
    const myDef = findFighter(selectedId);
    flashPose(myFighterRef, "kick");
    characterKick(myDef.sound);
    const blocked = aiBlockingRef.current && !aiGuardDownRef.current;
    aiGuardDownRef.current = false;
    const actual = blocked ? Math.round(KICK_DMG * 0.35) : KICK_DMG;
    aiHpRef.current = Math.max(0, aiHpRef.current - actual);
    setAiHp(aiHpRef.current);
    if (aiHpRef.current <= 0) endRound(true);
  }

  function castSpecial(index) {
    if (Date.now() < myStunnedUntilRef.current) return;
    const myDef = findFighter(selectedId);
    const special = myDef.specials[index];
    const now = Date.now();
    if (now - specialCooldownRefs.current[index] < special.cooldown) return;
    if (special.kind !== "ranged" && distanceRef.current > SPECIAL_RANGE) return;
    specialCooldownRefs.current[index] = now;
    setSpecialReady((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
    setTimeout(() => {
      setSpecialReady((prev) => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
    }, special.cooldown);

    flashPose(myFighterRef, "special", 400);
    characterSpecial(myDef.sound);
    setMySpecialFlash(true);
    setTimeout(() => setMySpecialFlash(false), 500);
    resolveSpecial(special, true);
    setLog(`You used ${special.name}!`);
    haptics.success();
  }

  function setBlock(value) {
    if (value && Date.now() < myStunnedUntilRef.current) return;
    blockingRef.current = value;
    setBlocking(value);
    if (value) haptics.tap();
  }
  function setMove(v) {
    moveRef.current = v;
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Titan Arena is a full 3D fighting game optimized for laptop and desktop play. Please switch to a larger
          screen to enter the arena.
        </p>
      </div>
    );
  }

  if (phase === "select") {
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber mb-2">CHOOSE YOUR FIGHTER</p>
        <p className="font-mono text-[11px] text-textDim mb-6">Opens in fullscreen. Best of 3 rounds. 10 fighters, 2 powers each.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {ROSTER.map((f) => (
            <button
              key={f.id}
              onClick={() => enterFullscreenAndFight(f.id)}
              className="rounded-xl border p-4 text-left hover:bg-bgPanel3 transition-colors"
              style={{ borderColor: hex(f.color) }}
            >
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="font-pixel text-[10px] text-textLight mb-1">{f.name}</p>
              <p className="font-mono text-[9px] text-textDim mb-2">{f.tagline}</p>
              {f.specials.map((sp, i) => (
                <p key={i} className="font-mono text-[9px] mb-0.5" style={{ color: hex(f.accent) }}>
                  ★ {sp.name} <span className="text-textDim">— {sp.desc}</span>
                </p>
              ))}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const myDef = findFighter(selectedId);
  const aiDef = findFighter(opponentId);

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-2 text-textDim">
        Wins — {myDef.name}: {myWins} · {aiDef.name}: {aiWins}
      </p>
      <div className="flex justify-between mb-2 max-w-lg mx-auto">
        <div className="w-[45%]">
          <div className="h-3 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${(myHp / MAX_HP) * 100}%`, background: hex(myDef.color) }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">
            {myDef.icon} {myDef.name} {myStunned && <span className="text-accentMagenta">STUNNED</span>}
          </p>
        </div>
        <div className="w-[45%]">
          <div className="h-3 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full transition-all ml-auto" style={{ width: `${(aiHp / MAX_HP) * 100}%`, background: hex(aiDef.color) }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">{aiDef.icon} {aiDef.name} {aiBlocking && "🛡️"}</p>
        </div>
      </div>

      <div
        ref={mountRef}
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor mb-3"
        style={{ width: "min(94vw, 720px)", height: 420, background: "#0d0720" }}
      >
        {mySpecialFlash && <div className="absolute inset-0 pointer-events-none" style={{ background: `${hex(myDef.accent)}22` }} />}
        {aiSpecialFlash && <div className="absolute inset-0 pointer-events-none" style={{ background: `${hex(aiDef.accent)}22` }} />}
      </div>

      <p className="font-mono text-[11px] mb-3 h-4" style={{ color: hex(myDef.accent) }}>{log}</p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onMouseDown={() => setMove(-1)}
          onMouseUp={() => setMove(0)}
          onMouseLeave={() => setMove(0)}
          className="px-4 py-3 rounded-md border border-lineColor font-pixel text-[10px] select-none"
        >
          ◀ CLOSE
        </button>
        <button
          onMouseDown={() => setMove(1)}
          onMouseUp={() => setMove(0)}
          onMouseLeave={() => setMove(0)}
          className="px-4 py-3 rounded-md border border-lineColor font-pixel text-[10px] select-none"
        >
          RETREAT ▶
        </button>
        <button onClick={punch} disabled={myStunned} className="px-4 py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-40" style={{ background: hex(myDef.color) }}>
          PUNCH
        </button>
        <button onClick={kick} disabled={myStunned} className="px-4 py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-40" style={{ background: "#ffb703" }}>
          KICK
        </button>
        <button
          onMouseDown={() => setBlock(true)}
          onMouseUp={() => setBlock(false)}
          onMouseLeave={() => setBlock(false)}
          disabled={myStunned}
          className="px-4 py-3 rounded-md border font-pixel text-[10px] select-none disabled:opacity-40"
          style={{ borderColor: "#3ee6e0", color: "#3ee6e0" }}
        >
          🛡️ BLOCK
        </button>
        {myDef.specials.map((sp, i) => (
          <button
            key={i}
            onClick={() => castSpecial(i)}
            disabled={!specialReady[i] || myStunned}
            className="px-4 py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-40"
            style={{ background: hex(myDef.accent) }}
          >
            ★ {sp.name}
          </button>
        ))}
      </div>
    </div>
  );
}
