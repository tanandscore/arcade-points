"use client";

import { useState } from "react";

// 7 territories in a small connected map. Adjacency defines who can
// attack whom. Player starts on A, the AI starts on G.
const TERRITORIES = ["A", "B", "C", "D", "E", "F", "G"];
const ADJACENCY = {
  A: ["B", "C"],
  B: ["A", "C", "D"],
  C: ["A", "B", "D", "E"],
  D: ["B", "C", "E", "F"],
  E: ["C", "D", "F", "G"],
  F: ["D", "E", "G"],
  G: ["E", "F"],
};
const TOTAL_ROUNDS = 6;
const POSITIONS = {
  A: { top: "10%", left: "10%" },
  B: { top: "10%", left: "55%" },
  C: { top: "38%", left: "32%" },
  D: { top: "38%", left: "72%" },
  E: { top: "66%", left: "45%" },
  F: { top: "66%", left: "85%" },
  G: { top: "88%", left: "60%" },
};

function initialState() {
  const owner = { A: "player", G: "ai" };
  const troops = { A: 6, G: 6 };
  for (const t of TERRITORIES) {
    if (!owner[t]) {
      owner[t] = "neutral";
      troops[t] = 2 + Math.floor(Math.random() * 3);
    }
  }
  return { owner, troops };
}

function ownedBy(state, side) {
  return TERRITORIES.filter((t) => state.owner[t] === side);
}

function aiTurn(state) {
  let next = { owner: { ...state.owner }, troops: { ...state.troops } };
  const aiTerritories = ownedBy(next, "ai");
  // reinforce a random owned territory
  if (aiTerritories.length) {
    const t = aiTerritories[Math.floor(Math.random() * aiTerritories.length)];
    next.troops[t] += aiTerritories.length;
  }
  // attack a random reachable weaker neighbor
  for (const source of aiTerritories) {
    const targets = ADJACENCY[source].filter((t) => next.owner[t] !== "ai" && next.troops[t] < next.troops[source]);
    if (targets.length && next.troops[source] > 3) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const winChance = next.troops[source] / (next.troops[source] + next.troops[target]);
      if (Math.random() < winChance) {
        next.owner[target] = "ai";
        next.troops[target] = Math.ceil(next.troops[source] / 2);
        next.troops[source] = Math.floor(next.troops[source] / 2);
      } else {
        next.troops[source] = Math.max(1, next.troops[source] - (1 + Math.floor(Math.random() * 3)));
      }
      break;
    }
  }
  return next;
}

export default function EmpireCommand({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState(initialState);
  const [round, setRound] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState("Choose one of your territories to attack from.");
  const [gameOver, setGameOver] = useState(false);

  function begin() {
    setStarted(true);
  }

  function finishGame(finalState) {
    setGameOver(true);
    const territories = ownedBy(finalState, "player").length;
    const troopTotal = ownedBy(finalState, "player").reduce((sum, t) => sum + finalState.troops[t], 0);
    const score = territories * 100 + troopTotal * 5;
    setTimeout(() => onFinish(score), 800);
  }

  function endRound(currentState) {
    const afterAI = aiTurn(currentState);
    setState(afterAI);
    setSelected(null);
    if (round >= TOTAL_ROUNDS || ownedBy(afterAI, "player").length === 0) {
      finishGame(afterAI);
    } else {
      setRound((r) => r + 1);
      setLog("Your move — pick a territory to attack from.");
    }
  }

  function handleTerritoryClick(t) {
    if (gameOver) return;
    if (!selected) {
      if (state.owner[t] === "player" && state.troops[t] > 1) {
        setSelected(t);
        setLog(`Selected ${t}. Now click an adjacent territory to attack.`);
      }
      return;
    }
    if (t === selected) {
      setSelected(null);
      setLog("Selection cleared.");
      return;
    }
    if (!ADJACENCY[selected].includes(t) || state.owner[t] === "player") {
      setLog("You can only attack an adjacent enemy or neutral territory.");
      return;
    }
    const next = { owner: { ...state.owner }, troops: { ...state.troops } };
    const winChance = next.troops[selected] / (next.troops[selected] + next.troops[t]);
    if (Math.random() < winChance) {
      next.owner[t] = "player";
      next.troops[t] = Math.ceil(next.troops[selected] / 2);
      next.troops[selected] = Math.floor(next.troops[selected] / 2);
      setLog(`Victory! ${t} is now yours.`);
    } else {
      next.troops[selected] = Math.max(1, next.troops[selected] - (1 + Math.floor(Math.random() * 3)));
      setLog(`Attack on ${t} failed — you lost troops.`);
    }
    setState(next);
    setSelected(null);
  }

  function reinforce(t) {
    if (state.owner[t] !== "player") return;
    setState((prev) => ({ ...prev, troops: { ...prev.troops, [t]: prev.troops[t] + 1 } }));
  }

  const colorFor = (side) => (side === "player" ? accentColor : side === "ai" ? "#ff3ea5" : "#a99fd6");

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Conquer territory from the AI over {TOTAL_ROUNDS} rounds. Click your territory, then an adjacent one to
          attack. Click your own territory again (or the reinforce button) to add a troop before ending your round.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START CAMPAIGN
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-2 text-textDim">
        Round {Math.min(round, TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
      </p>
      <p className="font-mono text-[11px] mb-4 h-8" style={{ color: accentColor }}>
        {log}
      </p>

      <div className="relative mx-auto rounded-lg border border-lineColor bg-bgDeep" style={{ width: "min(90vw, 340px)", height: "300px" }}>
        {TERRITORIES.map((t) => (
          <button
            key={t}
            onClick={() => handleTerritoryClick(t)}
            className="absolute rounded-full flex flex-col items-center justify-center font-mono text-[10px] border-2"
            style={{
              ...POSITIONS[t],
              width: "48px",
              height: "48px",
              background: "#241154",
              borderColor: selected === t ? "#ffffff" : colorFor(state.owner[t]),
              color: colorFor(state.owner[t]),
            }}
          >
            <span>{t}</span>
            <span>{state.troops[t]}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-5">
        {selected && (
          <button onClick={() => reinforce(selected)} className="font-mono text-[10px] px-3 py-2 rounded-md border border-lineColor text-textLight">
            +1 troop to {selected}
          </button>
        )}
        <button
          onClick={() => endRound(state)}
          disabled={gameOver}
          className="font-pixel text-[9px] px-5 py-2.5 rounded-md text-bgDeep disabled:opacity-50"
          style={{ background: accentColor }}
        >
          END ROUND ▸
        </button>
      </div>
    </div>
  );
}
