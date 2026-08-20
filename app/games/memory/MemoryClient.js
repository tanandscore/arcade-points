"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";

const ACCENT = "#ff3ea5";
const SYMBOLS = ["👾", "🕹️", "🚀", "⭐", "💎", "🍒", "🔔", "⚡"];

function shuffledDeck() {
  const deck = [...SYMBOLS, ...SYMBOLS].map((sym, i) => ({ id: i, sym }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryClient() {
  const [deck, setDeck] = useState(shuffledDeck);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const router = useRouter();

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
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  async function finish() {
    const score = Math.max(100, Math.round(1000 - moves * 15 - seconds * 3));
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "memory", score }),
    });
    const data = await res.json();
    setResult({ score, isNewBest: !!data.isNewBest, best: data.best ?? score });
  }

  function handleFlip(idx) {
    if (locked) return;
    if (flipped.includes(idx) || matched.includes(idx)) return;
    if (!started) setStarted(true);

    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].sym === deck[b].sym) {
        setTimeout(() => {
          setMatched((m) => [...m, a, b]);
          setFlipped([]);
          setLocked(false);
        }, 350);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, 700);
      }
    }
  }

  function playAgain() {
    finishedRef.current = false;
    setDeck(shuffledDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setResult(null);
  }

  return (
    <div className="relative">
      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>
          Moves: <span className="text-textLight">{moves}</span>
        </span>
        <span>
          Time: <span className="text-textLight">{seconds}s</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {deck.map((card, idx) => {
          const isUp = flipped.includes(idx) || matched.includes(idx);
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(idx)}
              className="aspect-square rounded-lg flex items-center justify-center text-xl sm:text-2xl border"
              style={{ background: isUp ? "#2a1560" : "#241154", borderColor: isUp ? ACCENT : "rgba(169,159,214,0.22)" }}
            >
              {isUp ? card.sym : ""}
            </button>
          );
        })}
      </div>

      {result && (
        <ResultOverlay
          gameName="Memory Match"
          accentColor={ACCENT}
          score={result.score}
          isNewBest={result.isNewBest}
          best={result.best}
          onPlayAgain={playAgain}
          onBack={() => router.push("/")}
        />
      )}
    </div>
  );
}
