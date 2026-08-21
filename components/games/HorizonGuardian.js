"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const TICK_MS = 45;
const COLONIST_COUNT = 6;

function freshColonists() {
  return Array.from({ length: COLONIST_COUNT }, (_, i) => ({
    id: i,
    x: 10 + i * (80 / (COLONIST_COUNT - 1)),
    alive: true,
  }));
}

export default function HorizonGuardian({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [ship, setShip] = useState({ x: 50, y: 50 });
  const [colonists, setColonists] = useState(freshColonists);
  const [abductors, setAbductors] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [score, setScore] = useState(0);
  const [lost, setLost] = useState(0);

  const shipRef = useRef({ x: 50, y: 50 });
  const moveRef = useRef({ x: 0, y: 0 });
  const facingRef = useRef({ x: 1, y: 0 });
  const lastShotRef = useRef(0);
  const scoreRef = useRef(0);
  const lostRef = useRef(0);
  const colonistsRef = useRef(colonists);
  const abductorsRef = useRef([]);
  const spawnTimerRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    colonistsRef.current = colonists;
  }, [colonists]);
  useEffect(() => {
    abductorsRef.current = abductors;
  }, [abductors]);

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
      shipRef.current.x = Math.max(4, Math.min(96, shipRef.current.x + moveRef.current.x * 2));
      shipRef.current.y = Math.max(4, Math.min(80, shipRef.current.y + moveRef.current.y * 2));
      setShip({ ...shipRef.current });
      if (moveRef.current.x || moveRef.current.y) facingRef.current = { ...moveRef.current };

      setBullets((prev) => prev.map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 1 })).filter((b) => b.life > 0));

      spawnTimerRef.current += 1;
      if (spawnTimerRef.current > 70 && abductorsRef.current.length < 4) {
        spawnTimerRef.current = 0;
        setAbductors((prev) => [...prev, { id: Math.random(), x: Math.random() * 100, y: 5, carrying: null, state: "hunting" }]);
      }

      setAbductors((prev) => {
        const next = prev.map((a) => {
          let { x, y, carrying, state } = a;
          if (state === "hunting") {
            const targets = colonistsRef.current.filter((c) => c.alive);
            if (!targets.length) return { ...a, y: y - 0.4 };
            const target = targets.reduce((best, c) => (Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best), targets[0]);
            x += Math.sign(target.x - x) * 0.7;
            y += 0.6;
            if (Math.abs(x - target.x) < 2 && y > 82) {
              carrying = target.id;
              state = "carrying";
              setColonists((cs) => cs.map((c) => (c.id === target.id ? { ...c, alive: false } : c)));
              sfx.wrong();
            }
          } else if (state === "carrying") {
            y -= 0.9;
            if (y < 0) {
              lostRef.current += 1;
              setLost(lostRef.current);
              return null;
            }
          }
          return { ...a, x, y, carrying, state };
        });
        return next.filter(Boolean);
      });

      setBullets((prevBullets) => {
        let bullets2 = prevBullets;
        let rescuedId = null;
        setAbductors((prevAb) => {
          const survivors = [];
          for (const a of prevAb) {
            const hb = bullets2.find((b) => Math.hypot(b.x - a.x, b.y - a.y) < 5);
            if (hb) {
              bullets2 = bullets2.filter((b) => b.id !== hb.id);
              scoreRef.current += a.carrying !== null ? 60 : 30;
              setScore(scoreRef.current);
              sfx.correct();
              if (a.carrying !== null) rescuedId = a.carrying;
            } else {
              survivors.push(a);
            }
          }
          return survivors;
        });
        if (rescuedId !== null) {
          setColonists((cs) => cs.map((c) => (c.id === rescuedId ? { ...c, alive: true } : c)));
        }
        return bullets2;
      });

      if (lostRef.current >= 5) finish();
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function fire() {
    const now = Date.now();
    if (now - lastShotRef.current < 220) return;
    lastShotRef.current = now;
    sfx.tap();
    const f = facingRef.current.x || facingRef.current.y ? facingRef.current : { x: 1, y: 0 };
    const mag = Math.hypot(f.x, f.y) || 1;
    setBullets((prev) => [
      ...prev,
      { id: Math.random(), x: shipRef.current.x, y: shipRef.current.y, vx: (f.x / mag) * 3.4, vy: (f.y / mag) * 3.4, life: 40 },
    ]);
  }

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Colonists stand along the ground. Abductors swoop down to grab them and fly them off the top of the
          screen — shoot an abductor to rescue whoever it's carrying. Lose 5 colonists and it's over.
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
        <span>Lost: {lost}/5</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 300, background: "#0d0720" }}
      >
        {colonists
          .filter((c) => c.alive)
          .map((c) => (
            <div key={c.id} className="absolute text-lg" style={{ left: `${c.x}%`, top: "86%", transform: "translate(-50%,-50%)" }}>
              🧍
            </div>
          ))}
        {abductors.map((a) => (
          <div key={a.id} className="absolute text-lg" style={{ left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%)" }}>
            {a.carrying !== null ? "😈" : "👽"}
          </div>
        ))}
        {bullets.map((b) => (
          <div
            key={b.id}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{ left: `${b.x}%`, top: `${b.y}%`, background: accentColor, transform: "translate(-50%,-50%)" }}
          />
        ))}
        <div className="absolute text-xl" style={{ left: `${ship.x}%`, top: `${ship.y}%`, transform: "translate(-50%,-50%)" }}>
          🚁
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
        <button onClick={fire} className="py-2.5 rounded-md font-pixel text-[9px] text-bgDeep" style={{ background: accentColor }}>
          FIRE
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
