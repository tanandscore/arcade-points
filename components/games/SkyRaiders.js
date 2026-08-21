"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const ROWS = 3;
const COLS = 6;
const TICK_MS = 45;

function freshWave() {
  const enemies = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      enemies.push({ id: `${r}-${c}`, row: r, col: c, alive: true });
    }
  }
  return enemies;
}

export default function SkyRaiders({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [enemies, setEnemies] = useState(freshWave);
  const [divers, setDivers] = useState([]);
  const [playerX, setPlayerX] = useState(50);
  const [bullets, setBullets] = useState([]);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);

  const playerXRef = useRef(50);
  const moveDirRef = useRef(0);
  const lastShotRef = useRef(0);
  const formationRef = useRef({ x: 15, y: 8, dir: 1, speed: 0.45 });
  const enemiesRef = useRef(enemies);
  const diversRef = useRef([]);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const diveTimerRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);
  useEffect(() => {
    diversRef.current = divers;
  }, [divers]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      const f = formationRef.current;
      f.x += f.dir * f.speed;
      if (f.x > 74 || f.x < 4) f.dir *= -1;

      playerXRef.current = Math.max(4, Math.min(94, playerXRef.current + moveDirRef.current * 2.4));
      setPlayerX(playerXRef.current);

      setBullets((prev) => prev.map((b) => ({ ...b, y: b.y - 4 })).filter((b) => b.y > -5));

      diveTimerRef.current += 1;
      if (diveTimerRef.current > 55) {
        diveTimerRef.current = 0;
        const alive = enemiesRef.current.filter((e) => e.alive);
        if (alive.length) {
          const diver = alive[Math.floor(Math.random() * alive.length)];
          const startX = f.x + diver.col * 11;
          const startY = f.y + diver.row * 9;
          setDivers((prev) => [...prev, { id: Math.random(), enemyId: diver.id, x: startX, y: startY, progress: 0 }]);
          setEnemies((prev) => prev.map((e) => (e.id === diver.id ? { ...e, alive: false } : e)));
        }
      }

      setDivers((prev) => {
        const next = [];
        for (const d of prev) {
          const progress = d.progress + 0.018;
          if (progress > 1.15) continue;
          const x = d.x + Math.sin(progress * Math.PI * 2.4) * 1.6;
          const y = d.y + progress * 85;
          next.push({ ...d, x, y, progress });
        }
        return next;
      });

      setBullets((prevBullets) => {
        let bullets = prevBullets;
        const f2 = formationRef.current;
        const currentEnemies = enemiesRef.current;
        let hit = false;
        const nextEnemies = currentEnemies.map((e) => {
          if (!e.alive) return e;
          const ex = f2.x + e.col * 11;
          const ey = f2.y + e.row * 9;
          const hb = bullets.find((b) => Math.abs(b.x - (ex + 3)) < 4.5 && Math.abs(b.y - (ey + 3)) < 5);
          if (hb) {
            bullets = bullets.filter((b) => b.id !== hb.id);
            hit = true;
            scoreRef.current += 10;
            setScore(scoreRef.current);
            return { ...e, alive: false };
          }
          return e;
        });
        if (hit) {
          sfx.correct();
          enemiesRef.current = nextEnemies;
          setEnemies(nextEnemies);
        }

        setDivers((prevDivers) => {
          let hitDiver = false;
          const survivors = prevDivers.filter((d) => {
            const hb = bullets.find((b) => Math.hypot(b.x - d.x, b.y - d.y) < 5);
            if (hb) {
              bullets = bullets.filter((b) => b.id !== hb.id);
              hitDiver = true;
              scoreRef.current += 25;
              setScore(scoreRef.current);
              return false;
            }
            return true;
          });
          if (hitDiver) sfx.correct();
          return survivors;
        });

        if (enemiesRef.current.every((e) => !e.alive) && diversRef.current.length === 0) {
          waveRef.current += 1;
          setWave(waveRef.current);
          const fresh = freshWave();
          enemiesRef.current = fresh;
          setEnemies(fresh);
          formationRef.current = { x: 15, y: 8, dir: 1, speed: 0.45 + waveRef.current * 0.12 };
        }

        return bullets;
      });

      const hitPlayer = diversRef.current.find((d) => d.y > 82 && Math.abs(d.x - playerXRef.current) < 5);
      if (hitPlayer) {
        sfx.wrong();
        setDivers((prev) => prev.filter((d) => d.id !== hitPlayer.id));
        livesRef.current -= 1;
        setLives(livesRef.current);
        if (livesRef.current <= 0) finish();
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function fire() {
    const now = Date.now();
    if (now - lastShotRef.current < 260) return;
    lastShotRef.current = now;
    sfx.tap();
    setBullets((prev) => [...prev, { id: Math.random(), x: playerXRef.current, y: 88 }]);
  }

  function setMove(dir) {
    moveDirRef.current = dir;
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          A formation holds above — but enemies periodically peel off and dive straight at you in sweeping curves.
          Shoot divers for a big bonus. Move with the arrows, tap FIRE. 3 lives.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span></span>
        <span>Wave {wave}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 340, background: "#0d0720" }}
      >
        {enemies
          .filter((e) => e.alive)
          .map((e) => (
            <div
              key={e.id}
              className="absolute text-sm"
              style={{ left: `${formationRef.current.x + e.col * 11}%`, top: `${formationRef.current.y + e.row * 9}%`, width: "10%" }}
            >
              🦋
            </div>
          ))}
        {divers.map((d) => (
          <div key={d.id} className="absolute text-base" style={{ left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%,-50%)" }}>
            🔻
          </div>
        ))}
        {bullets.map((b) => (
          <div key={b.id} className="absolute w-[3px] h-3 rounded-full" style={{ left: `${b.x}%`, top: `${b.y}%`, background: accentColor }} />
        ))}
        <div className="absolute text-xl" style={{ left: `${playerX}%`, top: "90%", transform: "translateX(-50%)" }}>
          🚀
        </div>
      </div>
      <div className="flex justify-center gap-3 mt-4">
        <button
          onMouseDown={() => setMove(-1)}
          onMouseUp={() => setMove(0)}
          onMouseLeave={() => setMove(0)}
          onTouchStart={() => setMove(-1)}
          onTouchEnd={() => setMove(0)}
          className="px-6 py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ◀
        </button>
        <button onClick={fire} className="px-8 py-3 rounded-md font-pixel text-xs text-bgDeep select-none" style={{ background: accentColor }}>
          FIRE
        </button>
        <button
          onMouseDown={() => setMove(1)}
          onMouseUp={() => setMove(0)}
          onMouseLeave={() => setMove(0)}
          onTouchStart={() => setMove(1)}
          onTouchEnd={() => setMove(0)}
          className="px-6 py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
