"use client";

import { useEffect, useRef, useState } from "react";

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

// Simple heuristic AI: win if possible, block if needed, else center/corner/random.
function computerMove(board) {
  const empties = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
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
  const startRef = useRef(performance.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const w = winner(board);
    if (w && !finishedRef.current) {
      finishedRef.current = true;
      setResult(w);
      const seconds = (performance.now() - startRef.current) / 1000;
      let score = 0;
      if (w === "X") score = Math.max(100, Math.round(400 - seconds * 10));
      else if (w === "draw") score = 80;
      else score = 20;
      setTimeout(() => onFinish(score), 900);
    } else if (!w && turn === "O") {
      const t = setTimeout(() => {
        const move = computerMove(board);
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
    <div className="text-center">
      <p className="font-mono text-xs mb-5 text-textDim">
        {result === "X" ? "You win!" : result === "O" ? "Computer wins" : result === "draw" ? "Draw" : turn === "X" ? "Your move (X)" : "Computer thinking..."}
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
