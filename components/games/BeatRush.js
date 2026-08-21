"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const TICK_MS = 30;
const TARGET_Y = 88;
const HIT_WINDOW = 7;
const ARROWS = ["◀", "▲", "▼", "▶"];
const KEY_MAP = { ArrowLeft: 0, ArrowUp: 1, ArrowDown: 2, ArrowRight: 3 };
const DIFFICULTY = {
  1: { label: "EASY", mult: 1, startSpeed: 1.1, maxSpeed: 2.0, rampRate: 0.0009 },
  2: { label: "MEDIUM", mult: 1.35, startSpeed: 1.4, maxSpeed: 2.6, rampRate: 0.0014 },
  3: { label: "HARD", mult: 1.8, startSpeed: 1.8, maxSpeed: 3.3, rampRate: 0.002 },
};

export default function BeatRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [notes, setNotes] = useState([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [judgment, setJudgment] = useState(null);
  const [flashLane, setFlashLane] = useState(null);

  const levelRef = useRef(1);
  const notesRef = useRef([]);
  const speedRef = useRef(1.1);
  const spawnTimerRef = useRef(0);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const missesRef = useRef(0);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    clearInterval(timerRef.current);
    sfx.lose();
    const mult = DIFFICULTY[levelRef.current].mult;
    onFinish(Math.round(scoreRef.current * mult));
  }

  function begin(chosenLevel) {
    levelRef.current = chosenLevel;
    setLevel(chosenLevel);
    const diff = DIFFICULTY[chosenLevel];
    speedRef.current = diff.startSpeed;
    setStarted(true);
    intervalRef.current = setInterval(() => {
      speedRef.current = Math.min(diff.maxSpeed, speedRef.current + diff.rampRate);

      spawnTimerRef.current += 1;
      if (spawnTimerRef.current > Math.max(18, 40 - Math.floor(speedRef.current * 8))) {
        spawnTimerRef.current = 0;
        const lane = Math.floor(Math.random() * 4);
        setNotes((prev) => [...prev, { id: Math.random(), lane, y: -8 }]);
      }

      setNotes((prev) => {
        const moved = prev.map((n) => ({ ...n, y: n.y + speedRef.current }));
        const surviving = moved.filter((n) => {
          if (n.y > TARGET_Y + HIT_WINDOW + 6) {
            missesRef.current += 1;
            comboRef.current = 0;
            setCombo(0);
            return false;
          }
          return true;
        });
        return surviving;
      });

      if (missesRef.current > 0) {
        missesRef.current = 0;
        sfx.wrong();
      }
    }, TICK_MS);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      clearInterval(timerRef.current);
    },
    []
  );

  function hitLane(lane) {
    setFlashLane(lane);
    setTimeout(() => setFlashLane(null), 100);

    const candidates = notesRef.current.filter((n) => n.lane === lane && Math.abs(n.y - TARGET_Y) < HIT_WINDOW + 4);
    if (!candidates.length) return;
    const best = candidates.reduce((a, b) => (Math.abs(a.y - TARGET_Y) < Math.abs(b.y - TARGET_Y) ? a : b));
    const diff = Math.abs(best.y - TARGET_Y);

    setNotes((prev) => prev.filter((n) => n.id !== best.id));

    let gained;
    let label;
    if (diff < 3) {
      gained = 30;
      label = "PERFECT";
    } else {
      gained = 15;
      label = "GOOD";
    }
    comboRef.current += 1;
    setCombo(comboRef.current);
    const comboMult = 1 + Math.min(2, comboRef.current * 0.05);
    scoreRef.current += Math.round(gained * comboMult);
    setScore(scoreRef.current);
    setJudgment(label);
    sfx.correct();
    setTimeout(() => setJudgment(null), 300);
  }

  useEffect(() => {
    function handleKey(e) {
      if (!started) return;
      if (e.key in KEY_MAP) hitLane(KEY_MAP[e.key]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Arrows scroll down toward the target line. Tap the matching direction (or use arrow keys) right as each
          one crosses it. Chain hits for a growing combo multiplier. 60 seconds.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-3">Choose a difficulty — faster levels score more per point.</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => begin(lvl)}
              className="px-4 py-3 rounded-md border font-pixel text-[10px]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              LVL {lvl}
              <div className="text-[8px] text-textDim mt-1">{DIFFICULTY[lvl].label} ×{DIFFICULTY[lvl].mult}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span></span>
        <span>Combo: {combo} · Lvl {level}</span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>{timeLeft}s</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor mb-4"
        style={{ width: "min(88vw, 260px)", height: 340, background: "#0d0720" }}
      >
        <div className="absolute left-0 right-0" style={{ top: `${TARGET_Y}%`, height: 2, background: accentColor, opacity: 0.6 }} />
        {[0, 1, 2, 3].map((lane) => (
          <div
            key={lane}
            className="absolute flex items-center justify-center font-pixel text-sm border rounded"
            style={{
              left: `${lane * 25}%`,
              top: `${TARGET_Y}%`,
              width: "24%",
              height: 28,
              transform: "translateY(-50%)",
              borderColor: flashLane === lane ? accentColor : "rgba(169,159,214,0.3)",
              background: flashLane === lane ? "rgba(62,230,224,0.15)" : "transparent",
              color: "#a99fd6",
            }}
          >
            {ARROWS[lane]}
          </div>
        ))}
        {notes.map((n) => (
          <div
            key={n.id}
            className="absolute flex items-center justify-center font-pixel text-sm rounded"
            style={{
              left: `${n.lane * 25}%`,
              top: `${n.y}%`,
              width: "24%",
              height: 26,
              transform: "translateY(-50%)",
              background: accentColor,
              color: "#0d0720",
            }}
          >
            {ARROWS[n.lane]}
          </div>
        ))}
        {judgment && (
          <div className="absolute inset-x-0 top-4 text-center font-pixel text-xs" style={{ color: judgment === "PERFECT" ? "#ffb703" : "#3ee6e0" }}>
            {judgment}
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-[280px] mx-auto">
        {ARROWS.map((a, i) => (
          <button
            key={i}
            onClick={() => hitLane(i)}
            className="py-3 rounded-md border border-lineColor font-pixel text-sm select-none"
            style={{ borderColor: flashLane === i ? accentColor : undefined }}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
