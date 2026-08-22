"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const TICK_MS = 45;
const MAG_SIZE = 6;
const RELOAD_MS = 900;

function spawnEnemy() {
  return { id: Math.random(), x: 15 + Math.random() * 70, telegraph: 30, alive: true, fired: false };
}

export default function FrontlineMarksman({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [enemies, setEnemies] = useState([]);
  const [exposed, setExposed] = useState(false);
  const [ammo, setAmmo] = useState(MAG_SIZE);
  const [reloading, setReloading] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);

  const exposedRef = useRef(false);
  const ammoRef = useRef(MAG_SIZE);
  const reloadingRef = useRef(false);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const enemiesRef = useRef([]);
  const spawnTimerRef = useRef(0);
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
      spawnTimerRef.current += 1;
      if (spawnTimerRef.current > 45 && enemiesRef.current.filter((e) => e.alive).length < 3) {
        spawnTimerRef.current = 0;
        setEnemies((prev) => [...prev, spawnEnemy()]);
      }

      setEnemies((prev) => {
        let tookDamage = false;
        const next = prev
          .map((e) => {
            if (!e.alive) return e;
            const telegraph = e.telegraph - 1;
            if (telegraph <= 0 && !e.fired) {
              if (exposedRef.current) {
                tookDamage = true;
              }
              return { ...e, telegraph: 0, fired: true, alive: false };
            }
            return { ...e, telegraph };
          })
          .filter((e) => e.alive || !e.fired);
        if (tookDamage) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) finish();
        }
        return next.filter((e) => e.alive);
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function toggleCover() {
    if (reloadingRef.current) return;
    exposedRef.current = !exposedRef.current;
    setExposed(exposedRef.current);
    sfx.select();
  }

  function shoot(id) {
    if (!exposedRef.current || reloadingRef.current || ammoRef.current <= 0) return;
    ammoRef.current -= 1;
    setAmmo(ammoRef.current);
    sfx.tap();
    setEnemies((prev) => {
      const target = prev.find((e) => e.id === id && e.alive);
      if (!target) return prev;
      scoreRef.current += 20;
      setScore(scoreRef.current);
      sfx.correct();
      return prev.map((e) => (e.id === id ? { ...e, alive: false, fired: true } : e));
    });
    if (ammoRef.current === 0) reload();
  }

  function reload() {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setReloading(true);
    sfx.select();
    setTimeout(() => {
      ammoRef.current = MAG_SIZE;
      setAmmo(MAG_SIZE);
      reloadingRef.current = false;
      setReloading(false);
    }, RELOAD_MS);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Toggle Cover to peek out — only exposed can you shoot, but you're only vulnerable while exposed too.
          Enemies telegraph before firing: expose, shoot, take cover. {MAG_SIZE} rounds per mag — reload before
          you're empty. 3 lives.
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
        <span>🔫 {reloading ? "..." : ammo}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border-2 mb-4"
        style={{ width: "min(90vw, 340px)", height: 260, background: "#0d0720", borderColor: exposed ? "#ff3ea5" : "#3ee6e0" }}
      >
        {enemies.map((e) => (
          <button
            key={e.id}
            onClick={() => shoot(e.id)}
            className="absolute text-2xl"
            style={{ left: `${e.x}%`, top: "45%", transform: "translate(-50%,-50%)", opacity: e.telegraph < 12 ? 1 : 0.6 }}
          >
            {e.telegraph < 12 ? "🎯" : "🙂"}
          </button>
        ))}
        <p className="absolute bottom-2 left-0 right-0 font-mono text-[10px] text-textDim">
          {exposed ? "EXPOSED — tap an enemy to shoot" : "IN COVER — safe, but can't shoot"}
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <button
          onClick={toggleCover}
          className="px-6 py-3 rounded-md font-pixel text-[10px] text-bgDeep"
          style={{ background: exposed ? "#ff3ea5" : accentColor }}
        >
          {exposed ? "TAKE COVER" : "EXPOSE"}
        </button>
        <button
          onClick={reload}
          disabled={reloading || ammo === MAG_SIZE}
          className="px-6 py-3 rounded-md border border-lineColor font-pixel text-[10px] disabled:opacity-40"
        >
          {reloading ? "RELOADING..." : "RELOAD"}
        </button>
      </div>
    </div>
  );
}
