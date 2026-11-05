"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((c) => c)) return "draw";
  return null;
}

function mistakeChanceForLevel(level) {
  return Math.max(0, 0.4 - (level - 1) * 0.07);
}

// Simple heuristic AI: win if possible, block if needed, else center/corner/random.
// mistakeChance lets lower levels play a random move instead of the
// smart one sometimes — a beginner can actually win early on, and the
// AI plays essentially perfectly by the higher levels.
function computerMove(board, mistakeChance) {
  const empties = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  if (Math.random() < mistakeChance) {
    return empties[Math.floor(Math.random() * empties.length)];
  }
  for (const i of empties) {
    const copy = [...board];
    copy[i] = "O";
    if (winner(copy) === "O") return i;
  }
  for (const i of empties) {
    const copy = [...board];
    copy[i] = "X";
    if (winner(copy) === "X") return i;
  }
  if (!board[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empties[Math.floor(Math.random() * empties.length)];
}

export default function TicTacDuel({ onFinish, accentColor }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [result, setResult] = useState(null);
  const [level, setLevel] = useState(1);
  const [runScore, setRunScore] = useState(0);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const startRef = useRef(performance.now());
  const finishedRef = useRef(false);
  const levelRef = useRef(1);
  const runScoreRef = useRef(0);

  useEffect(() => {
    const w = winner(board);
    if (w && !finishedRef.current) {
      if (w === "X") {
        // Winning doesn't end the run — a smarter AI steps up next,
        // score carries forward, until you actually lose a match.
        sfx.correct();
        const seconds = (performance.now() - startRef.current) / 1000;
        runScoreRef.current += Math.max(100, Math.round(400 - seconds * 10)) + 50 * levelRef.current;
        setRunScore(runScoreRef.current);
        setResult(w);
        setTimeout(() => {
          levelRef.current += 1;
          setLevel(levelRef.current);
          setBoard(Array(9).fill(null));
          setTurn("X");
          setResult(null);
          startRef.current = performance.now();
          sfx.levelUp();
          haptics.success();
          setLevelUpFlash(true);
          setTimeout(() => setLevelUpFlash(false), 1000);
        }, 900);
      } else if (w === "draw") {
        sfx.select();
        runScoreRef.current += 40;
        setRunScore(runScoreRef.current);
        setResult(w);
        setTimeout(() => {
          setBoard(Array(9).fill(null));
          setTurn("X");
          setResult(null);
          startRef.current = performance.now();
        }, 900);
      } else {
        finishedRef.current = true;
        sfx.wrong();
        setResult(w);
        setTimeout(() => onFinish(runScoreRef.current), 900);
      }
    } else if (!w && turn === "O") {
      const t = setTimeout(() => {
        const move = computerMove(board, mistakeChanceForLevel(levelRef.current));
        setBoard((prev) => {
          const next = [...prev];
          next[move] = "O";
          return next;
        });
        setTurn("X");
      }, 450);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn]);

  function handleCell(i) {
    if (board[i] || turn !== "X" || result) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setTurn("O");
  }

  return (
    <div className="text-center relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
        </div>
      )}
      <p className="font-mono text-[10px] mb-1 text-textDim">Level {level} · Score: {runScore}</p>
      <p className="font-mono text-xs mb-5 text-textDim">
        {result === "X" ? "You win! Next level..." : result === "O" ? "Computer wins — run over" : result === "draw" ? "Draw — playing again" : turn === "X" ? "Your move (X)" : "Computer thinking..."}
      </p>
      <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleCell(i)}
            className="aspect-square rounded-lg border font-pixel text-xl flex items-center justify-center"
            style={{
              borderColor: "rgba(169,159,214,0.22)",
              background: "#241154",
              color: cell === "X" ? accentColor : "#ff3ea5",
            }}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
