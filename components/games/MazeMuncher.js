"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

// # = wall, . = open floor (starts with a dot), space reserved for
// spawn points (still open floor, just drawn without extra meaning)
const MAZE = [
  "#############",
  "#...#...#...#",
  "#.#.#.#.#.#.#",
  "#...........#",
  "#.###.#.###.#",
  "#...........#",
  "#.#.#.#.#.#.#",
  "#...#...#...#",
  "#############",
];
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const PLAYER_START = { x: 1, y: 3 };
const ALL_CRITTER_STARTS = [
  { x: 11, y: 3 },
  { x: 6, y: 5 },
  { x: 1, y: 5 },
  { x: 11, y: 5 },
  { x: 6, y: 3 },
];
const MAX_CRITTERS = 5;
const CRITTER_TICK_MS = 420;

function isOpen(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS && MAZE[y][x] !== "#";
}

function freshDots() {
  const dots = new Set();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MAZE[y][x] === ".") dots.add(`${x},${y}`);
    }
  }
  dots.delete(`${PLAYER_START.x},${PLAYER_START.y}`);
  return dots;
}

function crittersForLevel(level) {
  const count = Math.min(MAX_CRITTERS, 2 + Math.floor((level - 1) / 2));
  return ALL_CRITTER_STARTS.slice(0, count).map((c) => ({ ...c }));
}

export default function MazeMuncher({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState(PLAYER_START);
  const [critters, setCritters] = useState(() => crittersForLevel(1));
  const [dots, setDots] = useState(freshDots);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const playerRef = useRef(PLAYER_START);
  const dotsRef = useRef(dots);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const critterIntervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    dotsRef.current = dots;
  }, [dots]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(critterIntervalRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function checkCollision(pPos, cList) {
    return cList.some((c) => c.x === pPos.x && c.y === pPos.y);
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

  function advanceLevel() {
    // Clearing the maze doesn't end the run — it escalates and keeps
    // going, with score carried forward, until you actually run out
    // of lives. This is the "just one more level" loop.
    scoreRef.current += 100 * levelRef.current;
    setScore(scoreRef.current);
    levelRef.current += 1;
    setLevel(levelRef.current);

    const nextDots = freshDots();
    dotsRef.current = nextDots;
    setDots(nextDots);
    setCritters(crittersForLevel(levelRef.current));
    playerRef.current = PLAYER_START;
    setPlayer(PLAYER_START);

    sfx.newBest();
    haptics.success();
    setLevelUpFlash(true);
    setTimeout(() => setLevelUpFlash(false), 1200);
  }

  function move(dx, dy) {
    if (!started || finishedRef.current) return;
    const next = { x: playerRef.current.x + dx, y: playerRef.current.y + dy };
    if (!isOpen(next.x, next.y)) return;
    playerRef.current = next;
    setPlayer(next);

    const key = `${next.x},${next.y}`;
    if (dotsRef.current.has(key)) {
      const nextDots = new Set(dotsRef.current);
      nextDots.delete(key);
      dotsRef.current = nextDots;
      setDots(nextDots);
      scoreRef.current += 10;
      setScore(scoreRef.current);
      sfx.select();
      if (nextDots.size === 0) {
        advanceLevel();
        return;
      }
    }

    setCritters((current) => {
      if (checkCollision(next, current)) handleCaught();
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
    critterIntervalRef.current = setInterval(() => {
      setCritters((current) => {
        const next = current.map((c) => {
          const dirs = [
            { x: c.x + 1, y: c.y },
            { x: c.x - 1, y: c.y },
            { x: c.x, y: c.y + 1 },
            { x: c.x, y: c.y - 1 },
          ].filter((d) => isOpen(d.x, d.y));
          return dirs.length ? dirs[Math.floor(Math.random() * dirs.length)] : c;
        });
        if (checkCollision(playerRef.current, next)) handleCaught();
        return next;
      });
    }, CRITTER_TICK_MS);
  }

  useEffect(() => () => clearInterval(critterIntervalRef.current), []);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Arrow keys or the d-pad below: collect every dot in the maze while dodging the roaming critters. Clear the
          maze and the next level starts automatically — harder, with your score carried forward. 3 lives, keep
          going as long as you can.
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
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: "min(90vw, 280px)", aspectRatio: `${COLS}/${ROWS}`, background: "#12092b" }}
        >
          {Array.from({ length: ROWS }).map((_, y) =>
            Array.from({ length: COLS }).map((_, x) => {
              const isWall = MAZE[y][x] === "#";
              const isPlayer = player.x === x && player.y === y;
              const isCritter = critters.some((c) => c.x === x && c.y === y);
              const hasDot = dots.has(`${x},${y}`);
              return (
                <div key={`${x}-${y}`} className="flex items-center justify-center" style={{ background: isWall ? "#241154" : "transparent" }}>
                  {isPlayer ? (
                    <div className="w-[70%] h-[70%] rounded-full" style={{ background: accentColor }} />
                  ) : isCritter ? (
                    <div className="w-[65%] h-[65%] rounded-full" style={{ background: "#ff3ea5" }} />
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
