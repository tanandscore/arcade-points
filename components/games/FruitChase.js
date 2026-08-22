"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAZE = [
  "#############",
  "#o..#...#..o#",
  "#.#.#.#.#.#.#",
  "#...........#",
  "#.###.#.###.#",
  "#...........#",
  "#.#.#.#.#.#.#",
  "#o..#...#..o#",
  "#############",
];
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const PLAYER_START = { x: 1, y: 3 };
const CHASER_STARTS = [
  { x: 11, y: 3, style: "hunter" },
  { x: 6, y: 5, style: "wanderer" },
];
const CENTER = { x: 6, y: 4 };
const CHASER_TICK_MS = 420;
const VULNERABLE_MS = 8000;

function isOpen(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS && MAZE[y][x] !== "#";
}

function initialDots() {
  const dots = new Set();
  const power = new Set();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MAZE[y][x] === ".") dots.add(`${x},${y}`);
      if (MAZE[y][x] === "o") power.add(`${x},${y}`);
    }
  }
  dots.delete(`${PLAYER_START.x},${PLAYER_START.y}`);
  return { dots, power };
}

export default function FruitChase({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState(PLAYER_START);
  const [chasers, setChasers] = useState(CHASER_STARTS);
  const [{ dots, power }, setPellets] = useState(initialDots);
  const [fruit, setFruit] = useState(null);
  const [vulnerable, setVulnerable] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const playerRef = useRef(PLAYER_START);
  const pelletsRef = useRef({ dots, power });
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const vulnerableRef = useRef(false);
  const vulnerableTimeoutRef = useRef(null);
  const chaserIntervalRef = useRef(null);
  const fruitTimerRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    pelletsRef.current = { dots, power };
  }, [dots, power]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(chaserIntervalRef.current);
    clearTimeout(vulnerableTimeoutRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function advanceLevel() {
    // Clearing the maze doesn't end the run — a fresh maze starts
    // immediately with score carried forward, until lives run out.
    scoreRef.current += 150 * levelRef.current;
    setScore(scoreRef.current);
    levelRef.current += 1;
    setLevel(levelRef.current);

    const fresh = initialDots();
    pelletsRef.current = fresh;
    setPellets(fresh);
    playerRef.current = PLAYER_START;
    setPlayer(PLAYER_START);
    setFruit(null);

    sfx.levelUp();
    haptics.success();
    setLevelUpFlash(true);
    setTimeout(() => setLevelUpFlash(false), 1200);
  }

  function handleCaught() {
    livesRef.current -= 1;
    setLives(livesRef.current);
    sfx.wrong();
    if (livesRef.current <= 0) {
      finish();
      return;
    }
    playerRef.current = PLAYER_START;
    setPlayer(PLAYER_START);
  }

  function move(dx, dy) {
    if (!started || finishedRef.current) return;
    const next = { x: playerRef.current.x + dx, y: playerRef.current.y + dy };
    if (!isOpen(next.x, next.y)) return;
    playerRef.current = next;
    setPlayer(next);

    const key = `${next.x},${next.y}`;
    const p = pelletsRef.current;
    if (p.dots.has(key)) {
      const nextDots = new Set(p.dots);
      nextDots.delete(key);
      pelletsRef.current = { dots: nextDots, power: p.power };
      setPellets({ dots: nextDots, power: p.power });
      scoreRef.current += 10;
      setScore(scoreRef.current);
      sfx.select();
      if (nextDots.size === 0) {
        advanceLevel();
        return;
      }
    } else if (p.power.has(key)) {
      const nextPower = new Set(p.power);
      nextPower.delete(key);
      pelletsRef.current = { dots: p.dots, power: nextPower };
      setPellets({ dots: p.dots, power: nextPower });
      scoreRef.current += 50;
      setScore(scoreRef.current);
      sfx.boost();
      vulnerableRef.current = true;
      setVulnerable(true);
      clearTimeout(vulnerableTimeoutRef.current);
      vulnerableTimeoutRef.current = setTimeout(() => {
        vulnerableRef.current = false;
        setVulnerable(false);
      }, VULNERABLE_MS);
    }

    setFruit((f) => {
      if (f && f.x === next.x && f.y === next.y) {
        scoreRef.current += 100;
        setScore(scoreRef.current);
        sfx.correct();
        return null;
      }
      return f;
    });

    setChasers((current) => {
      const hitIndex = current.findIndex((c) => c.x === next.x && c.y === next.y);
      if (hitIndex >= 0) {
        if (vulnerableRef.current) {
          sfx.correct();
          scoreRef.current += 150;
          setScore(scoreRef.current);
          const respawned = [...current];
          respawned[hitIndex] = { ...CHASER_STARTS[hitIndex] };
          return respawned;
        }
        handleCaught();
      }
      return current;
    });
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowUp") move(0, -1);
      if (e.key === "ArrowDown") move(0, 1);
      if (e.key === "ArrowLeft") move(-1, 0);
      if (e.key === "ArrowRight") move(1, 0);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function begin() {
    setStarted(true);
    chaserIntervalRef.current = setInterval(() => {
      setChasers((current) => {
        const next = current.map((c) => {
          const dirs = [
            { x: c.x + 1, y: c.y },
            { x: c.x - 1, y: c.y },
            { x: c.x, y: c.y + 1 },
            { x: c.x, y: c.y - 1 },
          ].filter((d) => isOpen(d.x, d.y));
          if (!dirs.length) return c;
          if (c.style === "hunter" && !vulnerableRef.current) {
            dirs.sort(
              (a, b) =>
                Math.hypot(a.x - playerRef.current.x, a.y - playerRef.current.y) -
                Math.hypot(b.x - playerRef.current.x, b.y - playerRef.current.y)
            );
            return { ...c, x: dirs[0].x, y: dirs[0].y };
          }
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          return { ...c, x: pick.x, y: pick.y };
        });
        const hitIndex = next.findIndex((c) => c.x === playerRef.current.x && c.y === playerRef.current.y);
        if (hitIndex >= 0) {
          if (vulnerableRef.current) {
            scoreRef.current += 150;
            setScore(scoreRef.current);
            sfx.correct();
            next[hitIndex] = { ...CHASER_STARTS[hitIndex] };
          } else {
            handleCaught();
          }
        }
        return next;
      });

      fruitTimerRef.current += 1;
      setFruit((f) => {
        if (!f && fruitTimerRef.current > 18) {
          fruitTimerRef.current = 0;
          setTimeout(() => setFruit((cur) => (cur && cur.x === CENTER.x && cur.y === CENTER.y ? null : cur)), 7000);
          return { x: CENTER.x, y: CENTER.y };
        }
        return f;
      });
    }, CHASER_TICK_MS);
  }

  useEffect(
    () => () => {
      clearInterval(chaserIntervalRef.current);
      clearTimeout(vulnerableTimeoutRef.current);
    },
    []
  );

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Collect every dot to clear the maze. Big power pellets (in the corners) let you eat the chasers for a
          while — grab bonus fruit when it appears in the center. 3 lives.
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
      <div className="relative">
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        <div
          className="mx-auto grid border border-lineColor rounded-lg overflow-hidden mb-4"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: "min(90vw, 280px)", aspectRatio: `${COLS}/${ROWS}`, background: vulnerable ? "#1a3a24" : "#12092b" }}
        >
          {Array.from({ length: ROWS }).map((_, y) =>
            Array.from({ length: COLS }).map((_, x) => {
              const isWall = MAZE[y][x] === "#";
            const isPlayer = player.x === x && player.y === y;
            const isChaser = chasers.some((c) => c.x === x && c.y === y);
            const isFruit = fruit && fruit.x === x && fruit.y === y;
            const hasDot = dots.has(`${x},${y}`);
            const hasPower = power.has(`${x},${y}`);
            return (
              <div key={`${x}-${y}`} className="flex items-center justify-center" style={{ background: isWall ? "#241154" : "transparent" }}>
                {isPlayer ? (
                  <div className="w-[70%] h-[70%] rounded-full" style={{ background: accentColor }} />
                ) : isChaser ? (
                  <div className="w-[65%] h-[65%] rounded-full" style={{ background: vulnerable ? "#3ee6e0" : "#ff3ea5" }} />
                ) : isFruit ? (
                  <span className="text-xs">🍒</span>
                ) : hasPower ? (
                  <div className="w-[45%] h-[45%] rounded-full" style={{ background: "#ffb703" }} />
                ) : hasDot ? (
                  <div className="w-[20%] h-[20%] rounded-full bg-textDim" />
                ) : null}
              </div>
            );
          })
        )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[160px] mx-auto">
        <div />
        <button onClick={() => move(0, -1)} className="py-2.5 rounded-md border border-lineColor">▲</button>
        <div />
        <button onClick={() => move(-1, 0)} className="py-2.5 rounded-md border border-lineColor">◀</button>
        <button onClick={() => move(0, 1)} className="py-2.5 rounded-md border border-lineColor">▼</button>
        <button onClick={() => move(1, 0)} className="py-2.5 rounded-md border border-lineColor">▶</button>
      </div>
    </div>
  );
}
