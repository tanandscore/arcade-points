"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const ROWS = 4;
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

export default function StarDefender({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [enemies, setEnemies] = useState(freshWave);
  const [playerX, setPlayerX] = useState(50);
  const [playerBullets, setPlayerBullets] = useState([]);
  const [enemyBullets, setEnemyBullets] = useState([]);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);

  const playerXRef = useRef(50);
  const moveDirRef = useRef(0);
  const lastShotRef = useRef(0);
  const formationRef = useRef({ x: 10, y: 6, dir: 1, speed: 0.5 });
  const enemiesRef = useRef(enemies);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

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
      if (f.x > 78 || f.x < 2) {
        f.dir *= -1;
        f.y += 4;
      }
      if (f.y > 68) {
        finish();
        return;
      }

      playerXRef.current = Math.max(4, Math.min(94, playerXRef.current + moveDirRef.current * 2.4));
      setPlayerX(playerXRef.current);

      setPlayerBullets((prev) => prev.map((b) => ({ ...b, y: b.y - 4 })).filter((b) => b.y > -5));
      setEnemyBullets((prev) => prev.map((b) => ({ ...b, y: b.y + 2.6 })).filter((b) => b.y < 105));

      if (Math.random() < 0.06) {
        const alive = enemiesRef.current.filter((e) => e.alive);
        if (alive.length) {
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          const ex = f.x + shooter.col * 12;
          const ey = f.y + shooter.row * 9;
          setEnemyBullets((prev) => [...prev, { id: Math.random(), x: ex + 3, y: ey + 4 }]);
        }
      }

      setPlayerBullets((prevBullets) => {
        let bullets = prevBullets;
        const currentEnemies = enemiesRef.current;
        let hitSomething = false;
        const nextEnemies = currentEnemies.map((e) => {
          if (!e.alive) return e;
          const ex = f.x + e.col * 12;
          const ey = f.y + e.row * 9;
          const hitBullet = bullets.find((b) => Math.abs(b.x - (ex + 3)) < 4.5 && Math.abs(b.y - (ey + 3)) < 5);
          if (hitBullet) {
            bullets = bullets.filter((b) => b.id !== hitBullet.id);
            hitSomething = true;
            scoreRef.current += 10;
            setScore(scoreRef.current);
            return { ...e, alive: false };
          }
          return e;
        });
        if (hitSomething) {
          sfx.correct();
          enemiesRef.current = nextEnemies;
          setEnemies(nextEnemies);
          if (nextEnemies.every((e) => !e.alive)) {
            waveRef.current += 1;
            setWave(waveRef.current);
            const fresh = freshWave();
            enemiesRef.current = fresh;
            setEnemies(fresh);
            formationRef.current = { x: 10, y: 6, dir: 1, speed: 0.5 + waveRef.current * 0.15 };
          }
        }
        return bullets;
      });

      setEnemyBullets((prevBullets) => {
        const hit = prevBullets.find((b) => b.y > 88 && Math.abs(b.x - playerXRef.current) < 5);
        if (!hit) return prevBullets;
        sfx.wrong();
        livesRef.current -= 1;
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          finish();
        }
        return prevBullets.filter((b) => b.id !== hit.id);
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function fire() {
    const now = Date.now();
    if (now - lastShotRef.current < 280) return;
    lastShotRef.current = now;
    sfx.tap();
    setPlayerBullets((prev) => [...prev, { id: Math.random(), x: playerXRef.current, y: 88 }]);
  }

  function setMove(dir) {
    moveDirRef.current = dir;
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          An advancing formation of enemies descends wave after wave. Move with the arrows, tap FIRE to shoot. Don't
          let them reach the bottom — 3 lives.
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
              className="absolute flex items-center justify-center text-sm"
              style={{
                left: `${formationRef.current.x + e.col * 12}%`,
                top: `${formationRef.current.y + e.row * 9}%`,
                width: "10%",
              }}
            >
              👾
            </div>
          ))}
        {playerBullets.map((b) => (
          <div key={b.id} className="absolute w-[3px] h-3 rounded-full" style={{ left: `${b.x}%`, top: `${b.y}%`, background: accentColor }} />
        ))}
        {enemyBullets.map((b) => (
          <div key={b.id} className="absolute w-[3px] h-3 rounded-full bg-accentMagenta" style={{ left: `${b.x}%`, top: `${b.y}%` }} />
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
