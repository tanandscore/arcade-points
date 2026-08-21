"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const GRID = 14;
const TICK_MS = 150;

function randomCell(exclude) {
  let cell;
  do {
    cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (exclude.some((c) => c.x === cell.x && c.y === cell.y));
  return cell;
}

export default function NeonSnake({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [snake, setSnake] = useState([{ x: 7, y: 7 }]);
  const [food, setFood] = useState({ x: 10, y: 7 });
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const dirRef = useRef({ x: 1, y: 0 });
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      const map = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const next = map[e.key];
      if (!next) return;
      // prevent reversing directly into yourself
      if (next.x === -dirRef.current.x && next.y === -dirRef.current.y) return;
      dirRef.current = next;
      setDir(next);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!started) return;
    intervalRef.current = setInterval(() => {
      setSnake((prev) => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
        const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
        const hitSelf = prev.some((c) => c.x === head.x && c.y === head.y);
        if (hitWall || hitSelf) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            clearInterval(intervalRef.current);
            sfx.lose();
            onFinish(Math.max(10, (prev.length - 1) * 25));
          }
          return prev;
        }
        const ateFood = head.x === food.x && head.y === food.y;
        const nextSnake = [head, ...prev];
        if (ateFood) {
          sfx.correct();
          setFood(randomCell(nextSnake));
        } else {
          nextSnake.pop();
        }
        return nextSnake;
      });
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, food]);

  function setDirection(next) {
    if (next.x === -dirRef.current.x && next.y === -dirRef.current.y) return;
    dirRef.current = next;
    setDir(next);
  }

  const cells = new Set(snake.map((c) => `${c.x},${c.y}`));

  return (
    <div className="text-center">
      {!started ? (
        <div>
          <p className="mb-6 text-textDim">Use arrow keys (or the buttons below on mobile) to steer. Eat food, don't hit walls or yourself.</p>
          <button onClick={() => setStarted(true)} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            START
          </button>
        </div>
      ) : (
        <>
          <div
            className="mx-auto grid border border-lineColor rounded-lg overflow-hidden mb-4"
            style={{
              gridTemplateColumns: `repeat(${GRID}, 1fr)`,
              width: "min(90vw, 320px)",
              aspectRatio: "1 / 1",
              background: "#12092b",
            }}
          >
            {Array.from({ length: GRID * GRID }).map((_, i) => {
              const x = i % GRID;
              const y = Math.floor(i / GRID);
              const isSnake = cells.has(`${x},${y}`);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isFood = food.x === x && food.y === y;
              return (
                <div
                  key={i}
                  style={{
                    background: isFood ? "#ffb703" : isSnake ? (isHead ? accentColor : "#2a1560") : "transparent",
                  }}
                />
              );
            })}
          </div>
          <p className="font-mono text-xs mb-4 text-textDim">Length: <span className="text-textLight">{snake.length}</span></p>
          <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto sm:hidden">
            <div />
            <button onClick={() => setDirection({ x: 0, y: -1 })} className="py-3 rounded-md border border-lineColor">▲</button>
            <div />
            <button onClick={() => setDirection({ x: -1, y: 0 })} className="py-3 rounded-md border border-lineColor">◀</button>
            <button onClick={() => setDirection({ x: 0, y: 1 })} className="py-3 rounded-md border border-lineColor">▼</button>
            <button onClick={() => setDirection({ x: 1, y: 0 })} className="py-3 rounded-md border border-lineColor">▶</button>
          </div>
        </>
      )}
    </div>
  );
}
