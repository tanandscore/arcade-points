"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const TICK_MS = 45;

function spawnEnemy(wave) {
  const edge = Math.floor(Math.random() * 4);
  const pos =
    edge === 0 ? { x: Math.random() * 100, y: -6 } :
    edge === 1 ? { x: 106, y: Math.random() * 80 + 10 } :
    edge === 2 ? { x: Math.random() * 100, y: 106 } :
    { x: -6, y: Math.random() * 80 + 10 };
  return { id: Math.random(), x: pos.x, y: pos.y, hp: 2 + Math.floor(wave / 3) };
}

export default function ShellSquad({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [player, setPlayer] = useState({ x: 50, y: 50 });
  const [enemies, setEnemies] = useState([]);
  const [attacking, setAttacking] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);

  const playerRef = useRef({ x: 50, y: 50 });
  const moveRef = useRef({ x: 0, y: 0 });
  const attackCooldownRef = useRef(0);
  const invulnRef = useRef(0);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const killsThisWaveRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const enemiesRef = useRef([]);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

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
      playerRef.current.x = Math.max(6, Math.min(94, playerRef.current.x + moveRef.current.x * 1.8));
      playerRef.current.y = Math.max(6, Math.min(94, playerRef.current.y + moveRef.current.y * 1.8));
      setPlayer({ ...playerRef.current });
      if (attackCooldownRef.current > 0) attackCooldownRef.current -= 1;
      if (invulnRef.current > 0) invulnRef.current -= 1;

      spawnTimerRef.current += 1;
      const spawnEvery = Math.max(35, 65 - waveRef.current * 3);
      if (spawnTimerRef.current > spawnEvery && enemiesRef.current.length < 3 + Math.min(3, waveRef.current)) {
        spawnTimerRef.current = 0;
        setEnemies((prev) => [...prev, spawnEnemy(waveRef.current)]);
      }

      setEnemies((prev) => {
        let tookHit = false;
        const next = prev.map((e) => {
          const dx = playerRef.current.x - e.x;
          const dy = playerRef.current.y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = e.x + (dx / dist) * 0.7;
          const ny = e.y + (dy / dist) * 0.7;
          if (dist < 6 && invulnRef.current === 0) tookHit = true;
          return { ...e, x: nx, y: ny };
        });
        if (tookHit) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          invulnRef.current = 30;
          if (livesRef.current <= 0) finish();
        }
        return next;
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function attack() {
    if (attackCooldownRef.current > 0) return;
    attackCooldownRef.current = 14;
    setAttacking(true);
    sfx.tap();
    setTimeout(() => setAttacking(false), 150);

    setEnemies((prev) => {
      let anyHit = false;
      const next = prev
        .map((e) => {
          const dist = Math.hypot(e.x - playerRef.current.x, e.y - playerRef.current.y);
          if (dist < 12) {
            anyHit = true;
            return { ...e, hp: e.hp - 1 };
          }
          return e;
        })
        .filter((e) => {
          if (e.hp <= 0) {
            scoreRef.current += 30;
            setScore(scoreRef.current);
            killsThisWaveRef.current += 1;
            return false;
          }
          return true;
        });
      if (anyHit) sfx.correct();
      if (killsThisWaveRef.current >= 6) {
        killsThisWaveRef.current = 0;
        waveRef.current += 1;
        setWave(waveRef.current);
      }
      return next;
    });
  }

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Enemies close in from every side. Move with the pad, tap STRIKE to hit everything nearby. Don't get
          surrounded — 3 lives, waves get tougher.
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
        <span>Score: <span className="text-textLight">{score}</span></span>
        <span>Wave {wave}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 320px)", height: 300, background: "#0d0720" }}
      >
        {enemies.map((e) => (
          <div key={e.id} className="absolute text-xl" style={{ left: `${e.x}%`, top: `${e.y}%`, transform: "translate(-50%,-50%)" }}>
            🥷
          </div>
        ))}
        <div
          className="absolute text-2xl"
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            transform: `translate(-50%,-50%) scale(${attacking ? 1.4 : 1})`,
            opacity: invulnRef.current > 0 ? 0.5 : 1,
          }}
        >
          🐢
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto mt-4">
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
        <button onClick={attack} className="py-2.5 rounded-md font-pixel text-[9px] text-bgDeep" style={{ background: accentColor }}>
          STRIKE
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
