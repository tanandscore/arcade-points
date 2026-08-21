"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const SYMBOLS = ["👾", "🕹️", "🚀", "⭐", "💎", "🍒", "🔔", "⚡"];

function shuffledDeck() {
  const deck = [...SYMBOLS, ...SYMBOLS].map((sym, i) => ({ id: i, sym }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryMatch({ onFinish, accentColor }) {
  const [deck] = useState(shuffledDeck);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (started && !finishedRef.current) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [started]);

  useEffect(() => {
    if (matched.length === deck.length && deck.length > 0 && !finishedRef.current) {
      finishedRef.current = true;
      clearInterval(intervalRef.current);
      onFinish(Math.max(100, Math.round(1000 - moves * 15 - seconds * 3)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  function handleFlip(idx) {
    if (locked) return;
    if (flipped.includes(idx) || matched.includes(idx)) return;
    if (!started) setStarted(true);
    sfx.select();

    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].sym === deck[b].sym) {
        sfx.correct();
        setTimeout(() => {
          setMatched((m) => [...m, a, b]);
          setFlipped([]);
          setLocked(false);
        }, 350);
      } else {
        sfx.wrong();
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, 700);
      }
    }
  }

  return (
    <div>
      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>Moves: <span className="text-textLight">{moves}</span></span>
        <span>Time: <span className="text-textLight">{seconds}s</span></span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {deck.map((card, idx) => {
          const isUp = flipped.includes(idx) || matched.includes(idx);
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(idx)}
              className="aspect-square rounded-lg flex items-center justify-center text-xl sm:text-2xl border"
              style={{ background: isUp ? "#2a1560" : "#241154", borderColor: isUp ? accentColor : "rgba(169,159,214,0.22)" }}
            >
              {isUp ? card.sym : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
