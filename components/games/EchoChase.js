"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TICK_MS = 45;
const HISTORY_MAX = 260;
const ORBS_PER_LEVEL = 5;
const FIRST_ECHO_DELAY = 160; // frames — roughly 7 seconds at TICK_MS

function randomOrb() {
  return { id: Math.random(), x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 };
}

export default function EchoChase({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [player, setPlayer] = useState({ x: 50, y: 50 });
  const [echoes, setEchoes] = useState([]);
  const [orb, setOrb] = useState(randomOrb);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const playerRef = useRef({ x: 50, y: 50 });
  const moveRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef([]);
  const echoesRef = useRef([]);
  const orbRef = useRef(orb);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const orbsCollectedRef = useRef(0);
  const levelRef = useRef(1);
  const invulnRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    echoesRef.current = echoes;
  }, [echoes]);
  useEffect(() => {
    orbRef.current = orb;
  }, [orb]);

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
      playerRef.current.x = Math.max(3, Math.min(97, playerRef.current.x + moveRef.current.x * 2.1));
      playerRef.current.y = Math.max(3, Math.min(97, playerRef.current.y + moveRef.current.y * 2.1));
      setPlayer({ ...playerRef.current });
      if (invulnRef.current > 0) invulnRef.current -= 1;

      // Record this frame's position — this is the "memory" every
      // echo replays from, delayed by however many frames back it was
      // spawned at.
      const history = historyRef.current;
      history.push({ x: playerRef.current.x, y: playerRef.current.y });
      if (history.length > HISTORY_MAX) history.shift();

      // Move every echo to where the player actually was that many
      // frames ago — a real, live replay of your own past self.
      const updatedEchoes = echoesRef.current.map((e) => {
        const idx = history.length - e.delayFrames;
        if (idx < 0) return e; // not enough history yet
        return { ...e, x: history[idx].x, y: history[idx].y };
      });
      echoesRef.current = updatedEchoes;
      setEchoes(updatedEchoes);

      // orb collection — reads orbRef, never a stale closure value
      const currentOrb = orbRef.current;
      const dx = playerRef.current.x - currentOrb.x;
      const dy = playerRef.current.y - currentOrb.y;
      if (Math.hypot(dx, dy) < 5) {
        sfx.correct();
        scoreRef.current += 20 * levelRef.current;
        setScore(scoreRef.current);
        orbsCollectedRef.current += 1;
        const nextOrb = randomOrb();
        orbRef.current = nextOrb;
        setOrb(nextOrb);

        if (orbsCollectedRef.current >= ORBS_PER_LEVEL) {
          orbsCollectedRef.current = 0;
          levelRef.current += 1;
          setLevel(levelRef.current);
          scoreRef.current += 60 * levelRef.current;
          setScore(scoreRef.current);
          // A new echo joins, spawned from further back in time —
          // more ghosts of you to dodge, forever.
          const newDelay = Math.max(50, FIRST_ECHO_DELAY - levelRef.current * 12);
          const nextEchoes = [...echoesRef.current, { id: Math.random(), delayFrames: newDelay, x: -10, y: -10 }];
          echoesRef.current = nextEchoes;
          setEchoes(nextEchoes);
          sfx.levelUp();
          haptics.success();
          setLevelUpFlash(true);
          setTimeout(() => setLevelUpFlash(false), 1000);
        }
      }

      // echo collision
      if (invulnRef.current === 0) {
        const hit = echoesRef.current.find(
          (e) => e.x >= 0 && Math.hypot(e.x - playerRef.current.x, e.y - playerRef.current.y) < 4.5
        );
        if (hit) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          invulnRef.current = 30;
          if (livesRef.current <= 0) finish();
        }
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  useEffect(() => {
    if (!started) return undefined;
    // seed the very first echo once the player has built up enough
    // history for it to have something to replay
    const t = setTimeout(() => {
      const first = [{ id: Math.random(), delayFrames: FIRST_ECHO_DELAY, x: -10, y: -10 }];
      echoesRef.current = first;
      setEchoes(first);
    }, FIRST_ECHO_DELAY * TICK_MS);
    return () => clearTimeout(t);
  }, [started]);

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Collect orbs and survive. After a while, an echo of your own past movement appears and starts replaying
          exactly where you were — touch it and you lose a life. Every level adds another echo, spawned from a
          different moment in your past. Score carries, keep going as long as you can dodge yourself.
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
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 340, background: "#0d0720" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}! +1 ECHO</p>
          </div>
        )}
        <div
          className="absolute w-4 h-4 rounded-full"
          style={{ left: `${orb.x}%`, top: `${orb.y}%`, transform: "translate(-50%,-50%)", background: "#ffb703" }}
        />
        {echoes
          .filter((e) => e.x >= 0)
          .map((e) => (
            <div
              key={e.id}
              className="absolute w-5 h-5 rounded-full border-2"
              style={{
                left: `${e.x}%`,
                top: `${e.y}%`,
                transform: "translate(-50%,-50%)",
                background: `${accentColor}33`,
                borderColor: accentColor,
              }}
            />
          ))}
        <div
          className="absolute w-5 h-5 rounded-full"
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            transform: "translate(-50%,-50%)",
            background: accentColor,
            opacity: invulnRef.current > 0 ? 0.5 : 1,
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto mt-4">
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
