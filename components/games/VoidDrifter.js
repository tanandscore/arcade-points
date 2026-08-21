"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const TICK_MS = 45;
const DIFFICULTY = {
  1: { label: "EASY", mult: 1, spawnEvery: 100, maxCount: 6, startCount: 3, speedMult: 1 },
  2: { label: "MEDIUM", mult: 1.35, spawnEvery: 75, maxCount: 9, startCount: 4, speedMult: 1.25 },
  3: { label: "HARD", mult: 1.8, spawnEvery: 55, maxCount: 12, startCount: 6, speedMult: 1.55 },
};

function spawnAsteroid(size = 3, speedMult = 1) {
  const edge = Math.floor(Math.random() * 4);
  const pos =
    edge === 0 ? { x: Math.random() * 100, y: -5 } :
    edge === 1 ? { x: 105, y: Math.random() * 100 } :
    edge === 2 ? { x: Math.random() * 100, y: 105 } :
    { x: -5, y: Math.random() * 100 };
  const angle = Math.random() * Math.PI * 2;
  const speed = (0.4 + Math.random() * 0.4) * speedMult;
  return { id: Math.random(), x: pos.x, y: pos.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size };
}

function wrap(v) {
  if (v < -5) return 105;
  if (v > 105) return -5;
  return v;
}

export default function VoidDrifter({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [ship, setShip] = useState({ x: 50, y: 50 });
  const [asteroids, setAsteroids] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);

  const levelRef = useRef(1);
  const shipRef = useRef({ x: 50, y: 50 });
  const moveRef = useRef({ x: 0, y: 0 });
  const lastShotRef = useRef(0);
  const invulnRef = useRef(0);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const asteroidsRef = useRef(asteroids);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const spawnTimerRef = useRef(0);

  useEffect(() => {
    asteroidsRef.current = asteroids;
  }, [asteroids]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    sfx.lose();
    const mult = DIFFICULTY[levelRef.current].mult;
    onFinish(Math.round(scoreRef.current * mult));
  }

  function begin(chosenLevel) {
    levelRef.current = chosenLevel;
    setLevel(chosenLevel);
    const diff = DIFFICULTY[chosenLevel];
    const initial = Array.from({ length: diff.startCount }, () => spawnAsteroid(3, diff.speedMult));
    setAsteroids(initial);
    asteroidsRef.current = initial;
    setStarted(true);
    intervalRef.current = setInterval(() => {
      shipRef.current.x = wrap(shipRef.current.x + moveRef.current.x * 2.2);
      shipRef.current.y = wrap(shipRef.current.y + moveRef.current.y * 2.2);
      setShip({ ...shipRef.current });
      if (invulnRef.current > 0) invulnRef.current -= 1;

      setBullets((prev) =>
        prev
          .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 1 }))
          .filter((b) => b.life > 0)
      );

      spawnTimerRef.current += 1;
      const currentDiff = DIFFICULTY[levelRef.current];
      if (spawnTimerRef.current > currentDiff.spawnEvery && asteroidsRef.current.length < currentDiff.maxCount) {
        spawnTimerRef.current = 0;
        setAsteroids((prev) => [...prev, spawnAsteroid(3, currentDiff.speedMult)]);
      }

      setAsteroids((prev) => {
        let next = prev.map((a) => ({ ...a, x: wrap(a.x + a.vx), y: wrap(a.y + a.vy) }));

        // bullet collisions
        setBullets((prevBullets) => {
          let remainingBullets = [...prevBullets];
          const survivors = [];
          for (const a of next) {
            const hitBullet = remainingBullets.find((b) => Math.hypot(b.x - a.x, b.y - a.y) < a.size * 2.2);
            if (hitBullet) {
              remainingBullets = remainingBullets.filter((b) => b.id !== hitBullet.id);
              scoreRef.current += (4 - a.size) * 15;
              setScore(scoreRef.current);
              sfx.correct();
              if (a.size > 1) {
                for (let i = 0; i < 2; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = 0.5 + Math.random() * 0.5;
                  survivors.push({ id: Math.random(), x: a.x, y: a.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: a.size - 1 });
                }
              }
            } else {
              survivors.push(a);
            }
          }
          next = survivors;
          return remainingBullets;
        });

        // ship collision
        if (invulnRef.current === 0) {
          const hitShip = next.find((a) => Math.hypot(a.x - shipRef.current.x, a.y - shipRef.current.y) < a.size * 2.2 + 2);
          if (hitShip) {
            sfx.wrong();
            livesRef.current -= 1;
            setLives(livesRef.current);
            invulnRef.current = 40;
            if (livesRef.current <= 0) finish();
          }
        }

        return next;
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function fire() {
    const now = Date.now();
    if (now - lastShotRef.current < 220) return;
    lastShotRef.current = now;
    sfx.tap();
    const dir = moveRef.current.x || moveRef.current.y ? moveRef.current : { x: 0, y: -1 };
    const mag = Math.hypot(dir.x, dir.y) || 1;
    setBullets((prev) => [
      ...prev,
      { id: Math.random(), x: shipRef.current.x, y: shipRef.current.y, vx: (dir.x / mag) * 3.2, vy: (dir.y / mag) * 3.2, life: 40 },
    ]);
  }

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Drift through open space — the field wraps at every edge. Move with the pad, tap FIRE to shoot in your last
          direction. Big asteroids split into smaller ones when hit. 3 lives.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-3">Choose a difficulty — higher levels score more per point.</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => begin(lvl)}
              className="px-4 py-3 rounded-md border font-pixel text-[10px]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              LVL {lvl}
              <div className="text-[8px] text-textDim mt-1">{DIFFICULTY[lvl].label} ×{DIFFICULTY[lvl].mult}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span></span>
        <span>Lvl {level}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 300, background: "#0d0720" }}
      >
        {asteroids.map((a) => (
          <div
            key={a.id}
            className="absolute rounded-full border-2"
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              width: `${a.size * 14}px`,
              height: `${a.size * 14}px`,
              borderColor: "#a99fd6",
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
        {bullets.map((b) => (
          <div
            key={b.id}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{ left: `${b.x}%`, top: `${b.y}%`, background: accentColor, transform: "translate(-50%,-50%)" }}
          />
        ))}
        <div
          className="absolute text-xl"
          style={{ left: `${ship.x}%`, top: `${ship.y}%`, transform: "translate(-50%,-50%)", opacity: invulnRef.current > 0 ? 0.4 : 1 }}
        >
          🛸
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto mt-4">
        <div />
        <button
          onMouseDown={() => setMove(0, -1)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(0, -1)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▲
        </button>
        <div />
        <button
          onMouseDown={() => setMove(-1, 0)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(-1, 0)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ◀
        </button>
        <button onClick={fire} className="py-2.5 rounded-md font-pixel text-[9px] text-bgDeep" style={{ background: accentColor }}>
          FIRE
        </button>
        <button
          onMouseDown={() => setMove(1, 0)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(1, 0)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▶
        </button>
        <div />
        <button
          onMouseDown={() => setMove(0, 1)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(0, 1)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▼
        </button>
        <div />
      </div>
    </div>
  );
}
