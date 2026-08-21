"use client";

import { useState } from "react";
import { sfx } from "@/lib/sound";

const TYPES = {
  fire: { label: "Pyra", icon: "🔥", beats: "grass" },
  water: { label: "Aquin", icon: "💧", beats: "fire" },
  grass: { label: "Sprigg", icon: "🌿", beats: "water" },
};
const TYPE_KEYS = Object.keys(TYPES);
const GAUNTLET_ROUNDS = 5;
const MAX_HP = 100;

function effectiveness(attackerType, defenderType) {
  if (TYPES[attackerType].beats === defenderType) return 1.5;
  if (TYPES[defenderType].beats === attackerType) return 0.65;
  return 1;
}

function opponentFor(round) {
  const type = TYPE_KEYS[Math.floor(Math.random() * TYPE_KEYS.length)];
  return {
    type,
    hp: 35 + round * 14,
    maxHp: 35 + round * 14,
    atk: 7 + round * 2,
  };
}

export default function CreatureClash({ onFinish, accentColor }) {
  const [chosenType, setChosenType] = useState(null);
  const [round, setRound] = useState(1);
  const [playerHp, setPlayerHp] = useState(MAX_HP);
  const [opponent, setOpponent] = useState(null);
  const [log, setLog] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [busy, setBusy] = useState(false);

  function choose(type) {
    setChosenType(type);
    setOpponent(opponentFor(1));
    setLog(`A wild ${TYPES[opponentFor(1).type]?.label || "creature"} appears!`);
  }

  function finishGame(won, finalOpponentDefeatedCount) {
    setGameOver(true);
    const score = finalOpponentDefeatedCount * 100 + Math.round((playerHp / MAX_HP) * 50) + (won ? 200 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 900);
  }

  function attack() {
    if (busy || gameOver || !opponent) return;
    setBusy(true);

    const dmgToOpp = Math.round((18 + Math.random() * 8) * effectiveness(chosenType, opponent.type));
    const newOppHp = Math.max(0, opponent.hp - dmgToOpp);
    sfx.hit();

    if (newOppHp === 0) {
      sfx.correct();
      const defeated = round;
      if (round >= GAUNTLET_ROUNDS) {
        setOpponent({ ...opponent, hp: 0 });
        setLog(`Victory! You've cleared all ${GAUNTLET_ROUNDS} battles!`);
        finishGame(true, defeated);
        return;
      }
      const healed = Math.min(MAX_HP, playerHp + 15);
      setPlayerHp(healed);
      setRound((r) => r + 1);
      const next = opponentFor(round + 1);
      setOpponent(next);
      setLog(`${TYPES[chosenType].label} wins the battle! A new challenger appears.`);
      setBusy(false);
      return;
    }

    setOpponent({ ...opponent, hp: newOppHp });

    // opponent counter-attacks
    const dmgToPlayer = Math.round(opponent.atk * effectiveness(opponent.type, chosenType));
    const newPlayerHp = Math.max(0, playerHp - dmgToPlayer);
    setPlayerHp(newPlayerHp);
    setLog(`You dealt ${dmgToOpp}. Took ${dmgToPlayer} back.`);

    if (newPlayerHp === 0) {
      sfx.wrong();
      finishGame(false, round - 1);
    }
    setBusy(false);
  }

  if (!chosenType) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Pick your creature. Fire beats Grass, Grass beats Water, Water beats Fire — choose wisely, then battle
          through {GAUNTLET_ROUNDS} rounds.
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {TYPE_KEYS.map((t) => (
            <button
              key={t}
              onClick={() => choose(t)}
              className="rounded-xl border border-lineColor p-4 bg-bgPanel3 hover:border-[--c]"
              style={{ "--c": accentColor }}
            >
              <div className="text-3xl mb-2">{TYPES[t].icon}</div>
              <p className="font-mono text-xs text-textLight">{TYPES[t].label}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-4 text-textDim">
        Battle {Math.min(round, GAUNTLET_ROUNDS)} of {GAUNTLET_ROUNDS}
      </p>

      <div className="flex items-center justify-around mb-5">
        <div>
          <div className="text-4xl mb-1">{TYPES[chosenType].icon}</div>
          <p className="font-mono text-[10px] text-textDim">{TYPES[chosenType].label}</p>
          <div className="w-24 h-2 rounded-full bg-bgDeep border border-lineColor mt-1 overflow-hidden">
            <div className="h-full bg-accentCyan" style={{ width: `${(playerHp / MAX_HP) * 100}%` }} />
          </div>
        </div>
        <div className="font-pixel text-xs text-textDim">VS</div>
        <div>
          <div className="text-4xl mb-1">{opponent ? TYPES[opponent.type].icon : ""}</div>
          <p className="font-mono text-[10px] text-textDim">{opponent ? TYPES[opponent.type].label : ""}</p>
          <div className="w-24 h-2 rounded-full bg-bgDeep border border-lineColor mt-1 overflow-hidden">
            <div className="h-full bg-accentMagenta" style={{ width: `${opponent ? (opponent.hp / opponent.maxHp) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <p className="font-mono text-[11px] mb-5 h-8 text-textDim">{log}</p>

      {!gameOver && (
        <button
          onClick={attack}
          disabled={busy}
          className="font-pixel text-[10px] px-8 py-3.5 rounded-md text-bgDeep disabled:opacity-50"
          style={{ background: accentColor }}
        >
          ATTACK ▸
        </button>
      )}
    </div>
  );
}
