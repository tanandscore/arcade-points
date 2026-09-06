"use client";

import { useState, useRef } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TYPES = {
  fire: { label: "Pyra", icon: "🔥", beats: "grass" },
  water: { label: "Aquin", icon: "💧", beats: "fire" },
  grass: { label: "Sprigg", icon: "🌿", beats: "water" },
};
const TYPE_KEYS = Object.keys(TYPES);
const TIER_SIZE = 5;
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
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const roundRef = useRef(1);

  function choose(type) {
    setChosenType(type);
    setOpponent(opponentFor(1));
    setLog(`A wild ${TYPES[opponentFor(1).type]?.label || "creature"} appears!`);
  }

  function finishGame(defeatedCount) {
    setGameOver(true);
    const score = defeatedCount * 100 + Math.round((playerHp / MAX_HP) * 50);
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
      // The gauntlet never truly "ends" on a win — every victory
      // brings a tougher challenger and the run keeps going, score
      // carried the whole way, until your creature actually faints.
      const healed = Math.min(MAX_HP, playerHp + 15);
      setPlayerHp(healed);
      const nextRound = roundRef.current + 1;
      roundRef.current = nextRound;
      setRound(nextRound);
      const next = opponentFor(nextRound);
      setOpponent(next);

      if (roundRef.current % TIER_SIZE === 1 && roundRef.current > 1) {
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
        setLog(`Tier cleared! A tougher challenger steps up.`);
      } else {
        setLog(`${TYPES[chosenType].label} wins the battle! A new challenger appears.`);
      }
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
      finishGame(roundRef.current - 1);
    }
    setBusy(false);
  }

  if (!chosenType) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Pick your creature. Fire beats Grass, Grass beats Water, Water beats Fire — choose wisely. Every victory
          brings a tougher challenger, forever — your score keeps climbing until your creature faints.
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
    <div className="text-center relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">TIER {Math.floor((round - 1) / TIER_SIZE) + 1}!</p>
        </div>
      )}
      <p className="font-mono text-xs mb-4 text-textDim">
        Battle {round} · Tier {Math.floor((round - 1) / TIER_SIZE) + 1}
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
