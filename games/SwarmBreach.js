"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TICK_MS = 45;
const SEGMENT_COUNT = 6;
const MAX_WORMS = 6;
const KILLS_PER_LEVEL = 8;

function freshWorm() {
  return {
    id: Math.random(),
    x: 10 + Math.random() * 70,
    y: 4,
    dir: Math.random() < 0.5 ? 1 : -1,
    trail: [],
  };
}

export default function SwarmBreach({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [worms, setWorms] = useState(() => [freshWorm(), freshWorm(), freshWorm()]);
  const [playerX, setPlayerX] = useState(50);
  const [bullets, setBullets] = useState([]);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const playerXRef = useRef(50);
  const moveDirRef = useRef(0);
  const lastShotRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const killsRef = useRef(0);
  const scoreRef = useRef(0);
  const wormsRef = useRef(worms);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    wormsRef.current = worms;
  }, [worms]);

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
      playerXRef.current = Math.max(4, Math.min(96, playerXRef.current + moveDirRef.current * 2.4));
      setPlayerX(playerXRef.current);

      setBullets((prev) => prev.map((b) => ({ ...b, y: b.y - 4 })).filter((b) => b.y > -5));

      setWorms((prevWorms) => {
        let escaped = false;
        const moved = prevWorms.map((w) => {
          let { x, dir, y } = w;
          x += dir * 1.1 * (1 + (levelRef.current - 1) * 0.12);
          if (x > 92 || x < 8) {
            dir *= -1;
            y += 6;
          }
          const trail = [{ x, y }, ...w.trail].slice(0, SEGMENT_COUNT * 3);
          if (y > 82) escaped = true;
          return { ...w, x, y, dir, trail };
        });

        if (escaped) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            finish();
            return moved;
          }
          return moved.map((w) => (w.y > 82 ? freshWorm() : w));
        }
        return moved;
      });

      // bullet vs worm segments
      setBullets((prevBullets) => {
        let bullets = prevBullets;
        const current = wormsRef.current;
        let killed = null;
        for (const w of current) {
          const segmentPoints = w.trail.filter((_, i) => i % 3 === 0);
          const hitBullet = bullets.find((b) => segmentPoints.some((p) => Math.hypot(p.x - b.x, p.y - b.y) < 4));
          if (hitBullet) {
            bullets = bullets.filter((b) => b.id !== hitBullet.id);
            killed = w.id;
            break;
          }
        }
        if (killed) {
          sfx.correct();
          scoreRef.current += 40;
          setScore(scoreRef.current);
          setWorms((prev) => prev.map((w) => (w.id === killed ? freshWorm() : w)));

          killsRef.current += 1;
          if (killsRef.current >= KILLS_PER_LEVEL) {
            killsRef.current = 0;
            levelRef.current += 1;
            setLevel(levelRef.current);
            scoreRef.current += 80 * levelRef.current;
            setScore(scoreRef.current);
            if (worms.length < MAX_WORMS) {
              setWorms((prev) => [...prev, freshWorm()]);
            }
            sfx.levelUp();
            haptics.success();
            setLevelUpFlash(true);
            setTimeout(() => setLevelUpFlash(false), 1200);
          }
        }
        return bullets;
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function fire() {
    const now = Date.now();
    if (now - lastShotRef.current < 220) return;
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
          Weaving swarm creatures descend from the top. Move with the arrows, tap FIRE to shoot straight up. Any
          creature that reaches the bottom costs a life — 3 lives.
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
        <span>Score: <span className="text-textLight">{score}</span> · Lvl {level}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 340, background: "#0d0720" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        {worms.map((w) =>
          w.trail
            .filter((_, i) => i % 3 === 0)
            .map((p, i) => (
              <div
                key={`${w.id}-${i}`}
                className="absolute w-3 h-3 rounded-full"
                style={{ left: `${p.x}%`, top: `${p.y}%`, background: i === 0 ? "#ff3ea5" : "#a99fd6", transform: "translate(-50%,-50%)" }}
              />
            ))
        )}
        {bullets.map((b) => (
          <div key={b.id} className="absolute w-[3px] h-3 rounded-full" style={{ left: `${b.x}%`, top: `${b.y}%`, background: accentColor }} />
        ))}
        <div className="absolute text-xl" style={{ left: `${playerX}%`, top: "90%", transform: "translateX(-50%)" }}>
          🔫
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
