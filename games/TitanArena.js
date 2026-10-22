"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildFighterModel, applyPose, updatePoseBlend } from "@/lib/fighterModel";
import { ROSTER, findFighter } from "@/lib/titanRoster";
import { sfx, createBattleMusic, characterPunch, characterKick, characterSpecial } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAX_HP = 100;
const AI_DIFFICULTY = {
  1: { label: "ROOKIE", mult: 1, aggressionMult: 0.7, specialMult: 0.65, blockMult: 0.7 },
  2: { label: "VETERAN", mult: 1.45, aggressionMult: 1.0, specialMult: 1.0, blockMult: 1.0 },
  3: { label: "CHAMPION", mult: 2.0, aggressionMult: 1.3, specialMult: 1.4, blockMult: 1.25 },
};
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
  const [phase, setPhase] = useState("select"); // select | difficulty-select | fighting | finished
  const [selectedId, setSelectedId] = useState(null);
  const [pendingFighterId, setPendingFighterId] = useState(null);
  const [difficulty, setDifficulty] = useState(2);
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
  const [slowMoFlash, setSlowMoFlash] = useState(false);
  const [myCombo, setMyCombo] = useState(0);

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
  const myComboRef = useRef(0);
  const difficultyRef = useRef(2);
  const myComboLastHitRef = useRef(0);
  const aiTimerRef = useRef(0);
  const aiLastSpecialRef = useRef([0, 0]);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);
  const myFighterRef = useRef(null);
  const aiFighterRef = useRef(null);
  const musicRef = useRef(null);
  const stunCheckRef = useRef(null);
  const sparkSpawnerRef = useRef(null);
  const shakeRef = useRef(0);

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

  function chooseFighter(fighterId) {
    setPendingFighterId(fighterId);
    setPhase("difficulty-select");
  }

  function confirmDifficultyAndFight(level) {
    difficultyRef.current = level;
    setDifficulty(level);
    setSelectedId(pendingFighterId);
    setOpponentId(pickOpponent(pendingFighterId));
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
    const score = Math.round((myWinsRef.current * 250 + Math.round((myHpRef.current / MAX_HP) * 100)) * AI_DIFFICULTY[difficultyRef.current].mult);
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
    resetMyCombo();
  }

  function flashPose(fighterRef, pose, duration = 260) {
    if (!fighterRef.current) return;
    applyPose(fighterRef.current, pose);
    setTimeout(() => {
      if (fighterRef.current) applyPose(fighterRef.current, "idle");
    }, duration);
  }

  const COMBO_WINDOW_MS = 1800;

  // Consecutive landed hits within the window build a real damage
  // bonus (up to +42% at a 6-hit chain), not just a counter for show
  // — this is what makes chaining attacks together an actual decision
  // worth making, not just a cosmetic number.
  function registerComboHit() {
    const now = Date.now();
    if (now - myComboLastHitRef.current < COMBO_WINDOW_MS) {
      myComboRef.current += 1;
    } else {
      myComboRef.current = 1;
    }
    myComboLastHitRef.current = now;
    setMyCombo(myComboRef.current);
    return 1 + Math.min(myComboRef.current - 1, 6) * 0.07;
  }

  function resetMyCombo() {
    if (myComboRef.current > 0) {
      myComboRef.current = 0;
      setMyCombo(0);
    }
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
      if (dmg > 0) dmg = Math.round(dmg * registerComboHit());
      aiHpRef.current = Math.max(0, aiHpRef.current - dmg);
      setAiHp(aiHpRef.current);
      if (dmg > 0 && aiFighterRef.current) {
        sparkSpawnerRef.current?.(aiFighterRef.current.position.x, aiFighterRef.current.position.z, findFighter(selectedId).accent);
        flashPose(aiFighterRef, "hit", 200);
      }
      if (selfHeal) {
        myHpRef.current = Math.min(MAX_HP, myHpRef.current + selfHeal);
        setMyHp(myHpRef.current);
      }
      if (aiHpRef.current <= 0) endRound(true);
    } else {
      myHpRef.current = Math.max(0, myHpRef.current - dmg);
      setMyHp(myHpRef.current);
      if (dmg > 0) {
        resetMyCombo();
        if (myFighterRef.current) {
          sparkSpawnerRef.current?.(myFighterRef.current.position.x, myFighterRef.current.position.z, findFighter(opponentId).accent);
          flashPose(myFighterRef, "hit", 200);
        }
        shakeRef.current = 0.22;
      }
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0720);
    scene.fog = new THREE.Fog(0x0d0720, 14, 34);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    const camBase = new THREE.Vector3(0, 3.4, 9);
    camera.position.copy(camBase);
    camera.lookAt(0, 1.8, 0);

    const arena = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a0f3d, roughness: 0.85 })
    );
    arena.position.y = -0.2;
    arena.receiveShadow = true;
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
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
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

    // Small hit-impact particles — plain little glowing cubes that
    // burst outward and fade, cheap enough to spawn freely and a real
    // step up from a flat color flash.
    const particles = [];
    function spawnHitSparks(x, z, color) {
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.08),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
        );
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.03 + Math.random() * 0.05;
        p.position.set(x, 1.6 + Math.random() * 0.6, z);
        p.userData = { vx: Math.cos(angle) * speed, vy: 0.02 + Math.random() * 0.03, vz: Math.sin(angle) * speed, life: 1 };
        scene.add(p);
        particles.push(p);
      }
    }
    sparkSpawnerRef.current = spawnHitSparks;

    let frameId;
    function render() {
      updatePoseBlend(myFighter);
      updatePoseBlend(aiFighter);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.x += p.userData.vx;
        p.position.y += p.userData.vy;
        p.position.z += p.userData.vz;
        p.userData.vy -= 0.0025;
        p.userData.life -= 0.045;
        p.material.opacity = Math.max(0, p.userData.life);
        if (p.userData.life <= 0) {
          scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          particles.splice(i, 1);
        }
      }

      // Camera shake — decays back to the base position each frame,
      // triggered externally by shakeRef being bumped up on a hit.
      if (shakeRef.current > 0) {
        camera.position.set(
          camBase.x + (Math.random() - 0.5) * shakeRef.current,
          camBase.y + (Math.random() - 0.5) * shakeRef.current,
          camBase.z
        );
        shakeRef.current *= 0.85;
        if (shakeRef.current < 0.01) shakeRef.current = 0;
      } else {
        camera.position.copy(camBase);
      }
      camera.lookAt(0, 1.8, 0);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();

    intervalRef.current = setInterval(() => {
      distanceRef.current = Math.max(0, Math.min(100, distanceRef.current + moveRef.current * 2.2));
      updatePositions();

      // A combo that goes quiet for too long fades on its own — not
      // just when the player gets hit.
      if (myComboRef.current > 0 && Date.now() - myComboLastHitRef.current > COMBO_WINDOW_MS) {
        myComboRef.current = 0;
        setMyCombo(0);
      }

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
        const basePersonality = aiDef.aiPersonality || { aggression: 0.5, blockChance: 0.35, specialEagerness: 0.4 };
        const diff = AI_DIFFICULTY[difficultyRef.current];
        const personality = {
          aggression: Math.min(0.95, basePersonality.aggression * diff.aggressionMult),
          blockChance: Math.min(0.85, basePersonality.blockChance * diff.blockMult),
          specialEagerness: Math.min(0.7, basePersonality.specialEagerness * diff.specialMult),
        };
        const readySpecials = aiDef.specials
          .map((sp, i) => ({ sp, i }))
          .filter(({ sp, i }) => now - aiLastSpecialRef.current[i] > sp.cooldown);

        // Tactical priority: a character with a heal special reaches
        // for it when genuinely hurt, rather than only picking
        // specials at random — this is what makes an AI feel like it
        // has a plan instead of just rolling dice every tick.
        const urgentHeal = readySpecials.find(({ sp }) => sp.kind === "heal" && aiHpRef.current < MAX_HP * 0.4);

        if (urgentHeal) {
          aiLastSpecialRef.current[urgentHeal.i] = now;
          setAiSpecialFlash(true);
          setTimeout(() => setAiSpecialFlash(false), 500);
          flashPose(aiFighterRef, "special", 400);
          characterSpecial(aiDef.sound);
          resolveSpecial(urgentHeal.sp, false);
          setLog(`${aiDef.name} used ${urgentHeal.sp.name}!`);
        } else if (distanceRef.current > KICK_RANGE && !aiDef.specials.some((s) => s.kind === "ranged")) {
          distanceRef.current = Math.max(0, distanceRef.current - 8);
        } else if (readySpecials.length && Math.random() < personality.specialEagerness) {
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
        } else if (Math.random() < personality.blockChance) {
          aiBlockingRef.current = true;
          setAiBlocking(true);
          setTimeout(() => {
            aiBlockingRef.current = false;
            setAiBlocking(false);
          }, 500);
        } else if (distanceRef.current < KICK_RANGE && Math.random() < personality.aggression + 0.15) {
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
          resetMyCombo();
          if (myFighterRef.current) {
            sparkSpawnerRef.current?.(myFighterRef.current.position.x, myFighterRef.current.position.z, aiDef.accent);
          }
          flashPose(myFighterRef, "hit", 200);
          shakeRef.current = 0.18;
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
    const matchOver = myWinsRef.current >= ROUNDS_TO_WIN || aiWinsRef.current >= ROUNDS_TO_WIN;
    if (matchOver) {
      // A real cinematic beat on the match-deciding blow — freeze the
      // action, darken the frame, show FINISH, then resolve. This is
      // the single highest-impact "feel" moment in any fighting game,
      // and it costs nothing but a well-placed pause.
      clearInterval(intervalRef.current);
      setSlowMoFlash(true);
      haptics.celebrate();
      setTimeout(() => {
        setSlowMoFlash(false);
        setLog(myWinsRef.current > aiWinsRef.current ? "VICTORY!" : "DEFEATED.");
        finishMatch();
      }, 900);
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
    const base = blocked ? Math.round(PUNCH_DMG * 0.35) : PUNCH_DMG;
    const actual = Math.round(base * registerComboHit());
    aiHpRef.current = Math.max(0, aiHpRef.current - actual);
    setAiHp(aiHpRef.current);
    if (aiFighterRef.current) {
      sparkSpawnerRef.current?.(aiFighterRef.current.position.x, aiFighterRef.current.position.z, myDef.accent);
    }
    flashPose(aiFighterRef, "hit", 200);
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
    const base = blocked ? Math.round(KICK_DMG * 0.35) : KICK_DMG;
    const actual = Math.round(base * registerComboHit());
    aiHpRef.current = Math.max(0, aiHpRef.current - actual);
    setAiHp(aiHpRef.current);
    if (aiFighterRef.current) {
      sparkSpawnerRef.current?.(aiFighterRef.current.position.x, aiFighterRef.current.position.z, myDef.accent);
    }
    flashPose(aiFighterRef, "hit", 200);
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
              onClick={() => chooseFighter(f.id)}
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

  if (phase === "difficulty-select") {
    const pendingDef = findFighter(pendingFighterId);
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber mb-2">CHOOSE YOUR CHALLENGE</p>
        <p className="font-mono text-[11px] text-textDim mb-6">
          Fighting as {pendingDef?.icon} {pendingDef?.name}. Tougher opponents score more.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-4">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => confirmDifficultyAndFight(lvl)}
              className="rounded-xl border p-5 hover:bg-bgPanel3 transition-colors"
              style={{ borderColor: "rgba(169,159,214,0.3)" }}
            >
              <p className="font-pixel text-[11px] text-textLight mb-1">{AI_DIFFICULTY[lvl].label}</p>
              <p className="font-mono text-[10px] text-accentAmber">×{AI_DIFFICULTY[lvl].mult} score</p>
            </button>
          ))}
        </div>
        <button onClick={() => setPhase("select")} className="font-mono text-[11px] text-textDim underline">
          ← Pick a different fighter
        </button>
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
        {myCombo >= 2 && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <p
              className="font-pixel text-sm"
              style={{ color: "#ffb703", textShadow: "0 0 12px #ffb70399" }}
            >
              {myCombo} HIT COMBO ▸ +{Math.min((myCombo - 1) * 7, 42)}%
            </p>
          </div>
        )}
        {/* Cinematic vignette + subtle color grade — pure CSS, zero
            rendering risk, but it's genuinely a big part of why
            fighting games "feel" dramatic rather than flat. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: "inset 0 0 90px 30px rgba(0,0,0,0.65)", mixBlendMode: "multiply" }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(20,5,35,0.35) 100%)" }}
        />
        {slowMoFlash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.35)" }}>
            <p className="font-pixel text-lg text-accentAmber ap-blink" style={{ textShadow: "0 0 20px #ffb703" }}>
              FINISH
            </p>
          </div>
        )}
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
