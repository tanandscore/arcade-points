"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const SYMBOLS = ["👾", "🕹️", "🚀", "⭐", "💎", "🍒", "🔔", "⚡", "🎯", "🌙", "🔥", "🍀", "🎲", "🏆"];
const SESSION_SECONDS = 90;

function pairsForLevel(level) {
  return Math.min(SYMBOLS.length, 8 + (level - 1) * 2);
}

function shuffledDeck(pairCount) {
  const symbols = SYMBOLS.slice(0, pairCount);
  const deck = [...symbols, ...symbols].map((sym, i) => ({ id: i, sym }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryMatch({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [deck, setDeck] = useState(() => shuffledDeck(pairsForLevel(1)));
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS);
  const [locked, setLocked] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const movesRef = useRef(0);
  const deckRef = useRef(deck);
  const matchedRef = useRef([]);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

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
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function advanceLevel() {
    // Clearing the board doesn't end the run — a bigger, harder board
    // starts immediately, score carries forward, until the 90-second
    // session timer runs out.
    const levelBonus = 100 * levelRef.current + Math.max(0, 60 - movesRef.current) * 2;
    scoreRef.current += levelBonus;
    setScore(scoreRef.current);
    levelRef.current += 1;
    setLevel(levelRef.current);
    movesRef.current = 0;
    setMoves(0);

    const nextDeck = shuffledDeck(pairsForLevel(levelRef.current));
    deckRef.current = nextDeck;
    setDeck(nextDeck);
    matchedRef.current = [];
    setMatched([]);
    setFlipped([]);

    sfx.levelUp();
    haptics.success();
    setLevelUpFlash(true);
    setTimeout(() => setLevelUpFlash(false), 1200);
  }

  function handleFlip(idx) {
    if (locked || finishedRef.current) return;
    if (flipped.includes(idx) || matchedRef.current.includes(idx)) return;
    if (!started) begin();
    sfx.select();

    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setLocked(true);
      movesRef.current += 1;
      setMoves(movesRef.current);
      const [a, b] = next;
      if (deckRef.current[a].sym === deckRef.current[b].sym) {
        sfx.correct();
        setTimeout(() => {
          const nextMatched = [...matchedRef.current, a, b];
          matchedRef.current = nextMatched;
          setMatched(nextMatched);
          setFlipped([]);
          setLocked(false);
          if (nextMatched.length === deckRef.current.length) {
            advanceLevel();
          }
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
      {!started && (
        <p className="mb-4 text-textDim text-sm text-center">
          Match every pair before the 90-second timer runs out. Clear the board and the next level starts
          automatically with more pairs — your score keeps growing until time's up.
        </p>
      )}
      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 15 ? "#ff3ea5" : "#a99fd6" }}>{started ? `${timeLeft}s` : `${SESSION_SECONDS}s`}</span>
      </div>
      <div className="relative">
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
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
    </div>
  );
}
