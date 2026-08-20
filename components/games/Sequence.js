"use client";

import { useEffect, useRef, useState } from "react";

const PADS = [
  { id: 0, color: "#3ee6e0" },
  { id: 1, color: "#ff3ea5" },
  { id: 2, color: "#ffb703" },
  { id: 3, color: "#b6ff3e" },
];

export default function Sequence({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [sequence, setSequence] = useState([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [showing, setShowing] = useState(false);
  const [litPad, setLitPad] = useState(null);
  const [status, setStatus] = useState("watch"); // watch | yourTurn
  const finishedRef = useRef(false);

  function begin() {
    setStarted(true);
    const first = [Math.floor(Math.random() * 4)];
    setSequence(first);
    playSequence(first);
  }

  function playSequence(seq) {
    setStatus("watch");
    setPlayerStep(0);
    let i = 0;
    function step() {
      if (i >= seq.length) {
        setStatus("yourTurn");
        return;
      }
      setLitPad(seq[i]);
      setTimeout(() => {
        setLitPad(null);
        setTimeout(() => {
          i += 1;
          step();
        }, 200);
      }, 450);
    }
    step();
  }

  function handlePad(id) {
    if (status !== "yourTurn") return;
    if (id === sequence[playerStep]) {
      const next = playerStep + 1;
      if (next === sequence.length) {
        const grown = [...sequence, Math.floor(Math.random() * 4)];
        setTimeout(() => {
          setSequence(grown);
          playSequence(grown);
        }, 500);
      } else {
        setPlayerStep(next);
      }
    } else if (!finishedRef.current) {
      finishedRef.current = true;
      onFinish(Math.max(10, (sequence.length - 1) * 30));
    }
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">Watch the pattern light up, then repeat it. Each round adds one more step.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-5 text-textDim">
        {status === "watch" ? "Watch closely..." : `Your turn — step ${playerStep + 1} of ${sequence.length}`}
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-[220px] mx-auto">
        {PADS.map((pad) => (
          <button
            key={pad.id}
            onClick={() => handlePad(pad.id)}
            disabled={status !== "yourTurn"}
            className="aspect-square rounded-xl border transition-opacity"
            style={{
              background: pad.color,
              opacity: litPad === pad.id ? 1 : 0.35,
              borderColor: "rgba(169,159,214,0.22)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
