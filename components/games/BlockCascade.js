"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const COLS = 8;
const ROWS = 14;
const BASE_TICK_MS = 600;

// Each piece: 4 rotation states, each a list of [x, y] cell offsets
// within a 4x4 box. These are generic polyomino shapes (the same
// small set used across countless falling-block games) — no branding
// or exact source borrowed, just the underlying geometry.
const PIECES = {
  I: { color: "#3ee6e0", rotations: [
    [[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]],
  ]},
  O: { color: "#ffb703", rotations: [
    [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]],
  ]},
  T: { color: "#ff3ea5", rotations: [
    [[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]],
  ]},
  S: { color: "#b6ff3e", rotations: [
    [[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]],
  ]},
  Z: { color: "#ff5a3c", rotations: [
    [[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]],
  ]},
  J: { color: "#3ee6e0", rotations: [
    [[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]],
  ]},
  L: { color: "#ffb703", rotations: [
    [[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]],
  ]},
};
const PIECE_KEYS = Object.keys(PIECES);

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const type = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { type, rotation: 0, x: 2, y: 0 };
}

function cellsFor(piece) {
  return PIECES[piece.type].rotations[piece.rotation].map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
}

function collides(board, piece) {
  return cellsFor(piece).some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]));
}

export default function BlockCascade({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const scoreRef = useRef(0);
  const totalLinesRef = useRef(0);
  const levelRef = useRef(1);
  const intervalRef = useRef(null);
  const rampRef = useRef(null);
  const finishedRef = useRef(false);
  const speedRef = useRef(BASE_TICK_MS);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  useEffect(() => {
    pieceRef.current = piece;
  }, [piece]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    clearInterval(rampRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function lockPiece() {
    const newBoard = boardRef.current.map((row) => [...row]);
    for (const [x, y] of cellsFor(pieceRef.current)) {
      if (y < 0) {
        finish();
        return;
      }
      newBoard[y][x] = PIECES[pieceRef.current.type].color;
    }

    let cleared = 0;
    const kept = newBoard.filter((row) => {
      const full = row.every((cell) => cell);
      if (full) cleared += 1;
      return !full;
    });
    while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));

    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] || 1000;
      scoreRef.current += points;
      setScore(scoreRef.current);
      sfx.correct();
      speedRef.current = Math.max(180, speedRef.current - 12);

      totalLinesRef.current += cleared;
      const newLevel = Math.floor(totalLinesRef.current / 10) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        scoreRef.current += 150;
        setScore(scoreRef.current);
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1200);
      }
    } else {
      scoreRef.current += 2;
      setScore(scoreRef.current);
    }

    setBoard(kept);
    boardRef.current = kept;

    const next = randomPiece();
    if (collides(kept, next)) {
      finish();
      return;
    }
    setPiece(next);
    pieceRef.current = next;
  }

  function tick() {
    const moved = { ...pieceRef.current, y: pieceRef.current.y + 1 };
    if (collides(boardRef.current, moved)) {
      lockPiece();
    } else {
      setPiece(moved);
      pieceRef.current = moved;
    }
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(tick, speedRef.current);
    // periodically restart the tick interval so speed-ups (from
    // clearing rows) actually take effect without a full re-render loop
    rampRef.current = setInterval(() => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, speedRef.current);
    }, 3000);
  }

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      clearInterval(rampRef.current);
    },
    []
  );

  function move(dx) {
    const moved = { ...pieceRef.current, x: pieceRef.current.x + dx };
    if (!collides(boardRef.current, moved)) {
      setPiece(moved);
      pieceRef.current = moved;
      sfx.select();
    }
  }

  function rotate() {
    const rotated = { ...pieceRef.current, rotation: (pieceRef.current.rotation + 1) % 4 };
    if (!collides(boardRef.current, rotated)) {
      setPiece(rotated);
      pieceRef.current = rotated;
      sfx.select();
    } else {
      const kicked = { ...rotated, x: rotated.x - 1 };
      if (!collides(boardRef.current, kicked)) {
        setPiece(kicked);
        pieceRef.current = kicked;
      }
    }
  }

  useEffect(() => {
    function handleKey(e) {
      if (!started) return;
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowUp") rotate();
      if (e.key === "ArrowDown") tick();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Arrow keys or the buttons below: move, rotate, and drop falling blocks to clear full rows before they stack
          to the top. Every 10 lines cleared, the level goes up and the drop speeds up — your score always carries
          forward.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  const activeCells = new Set(cellsFor(piece).map(([x, y]) => `${x},${y}`));
  const activeColor = PIECES[piece.type].color;

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-3 text-textDim">
        Score: <span className="text-textLight">{score}</span> · Lvl {level}
      </p>
      <div className="relative">
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
      <div
        className="mx-auto grid border border-lineColor rounded-lg overflow-hidden mb-4"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: "min(80vw, 200px)", aspectRatio: `${COLS}/${ROWS}`, background: "#12092b" }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => {
            const isActive = activeCells.has(`${x},${y}`);
            return (
              <div
                key={`${x}-${y}`}
                style={{ background: isActive ? activeColor : cell || "transparent", border: "1px solid rgba(169,159,214,0.08)" }}
              />
            );
          })
        )}
      </div>
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        <button onClick={() => move(-1)} className="py-2.5 rounded-md border border-lineColor font-pixel text-xs">◀</button>
        <button onClick={rotate} className="py-2.5 rounded-md border font-pixel text-xs" style={{ borderColor: accentColor, color: accentColor }}>⟳</button>
        <button onClick={tick} className="py-2.5 rounded-md border border-lineColor font-pixel text-xs">▼</button>
        <button onClick={() => move(1)} className="py-2.5 rounded-md border border-lineColor font-pixel text-xs">▶</button>
      </div>
    </div>
  );
}
