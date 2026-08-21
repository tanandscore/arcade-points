"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 75;

const BUILDINGS = {
  house: { label: "House", baseCost: { wood: 10 }, effect: "population" },
  farm: { label: "Farm", baseCost: { wood: 15 }, effect: "food/sec" },
  sawmill: { label: "Sawmill", baseCost: { food: 15 }, effect: "wood/sec" },
  market: { label: "Market", baseCost: { wood: 20, food: 20 }, effect: "+50 score" },
};

function costFor(type, ownedCount) {
  const base = BUILDINGS[type].baseCost;
  const multiplier = Math.pow(1.3, ownedCount);
  const cost = {};
  for (const [resource, amount] of Object.entries(base)) {
    cost[resource] = Math.ceil(amount * multiplier);
  }
  return cost;
}

function canAfford(resources, cost) {
  return Object.entries(cost).every(([r, amount]) => resources[r] >= amount);
}

export default function ColonyRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [wood, setWood] = useState(20);
  const [food, setFood] = useState(20);
  const [buildings, setBuildings] = useState({ house: 0, farm: 0, sawmill: 0, market: 0 });
  const [bonusScore, setBonusScore] = useState(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const stateRef = useRef({ wood, food, buildings, bonusScore });

  useEffect(() => {
    stateRef.current = { wood, food, buildings, bonusScore };
  }, [wood, food, buildings, bonusScore]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const { wood: w, food: f, buildings: b, bonusScore: bonus } = stateRef.current;
    const totalBuildings = b.house + b.farm + b.sawmill + b.market;
    const population = b.house * 3;
    const score = population * 10 + Math.floor(w) + Math.floor(f) + totalBuildings * 20 + bonus;
    onFinish(Math.max(0, score));
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
      // passive income from built farms/sawmills
      setFood((f) => f + stateRef.current.buildings.farm);
      setWood((w) => w + stateRef.current.buildings.sawmill);
    }, 1000);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function gatherWood() {
    sfx.click();
    setWood((w) => w + 4);
  }

  function gatherFood() {
    sfx.click();
    setFood((f) => f + 4);
  }

  function build(type) {
    const cost = costFor(type, buildings[type]);
    if (!canAfford({ wood, food }, cost)) {
      sfx.wrong();
      return;
    }
    sfx.correct();
    setWood((w) => w - (cost.wood || 0));
    setFood((f) => f - (cost.food || 0));
    setBuildings((b) => ({ ...b, [type]: b[type] + 1 }));
    if (type === "market") setBonusScore((s) => s + 50);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          75 seconds. Gather wood and food, then spend them on Houses, Farms, Sawmills, and Markets to grow your
          score before time runs out.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>
          🪵 <span className="text-textLight">{Math.floor(wood)}</span> · 🌾 <span className="text-textLight">{Math.floor(food)}</span>
        </span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={gatherWood} className="rounded-md py-3 font-mono text-xs border border-lineColor text-textLight bg-bgPanel3">
          🪓 Chop Wood +4
        </button>
        <button onClick={gatherFood} className="rounded-md py-3 font-mono text-xs border border-lineColor text-textLight bg-bgPanel3">
          🌾 Gather Food +4
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(BUILDINGS).map(([type, def]) => {
          const cost = costFor(type, buildings[type]);
          const affordable = canAfford({ wood, food }, cost);
          const costLabel = Object.entries(cost)
            .map(([r, a]) => `${a}${r === "wood" ? "🪵" : "🌾"}`)
            .join(" ");
          return (
            <button
              key={type}
              onClick={() => build(type)}
              className="rounded-md p-3 border text-left transition-opacity"
              style={{
                borderColor: affordable ? accentColor : "rgba(169,159,214,0.22)",
                background: "#241154",
                opacity: affordable ? 1 : 0.5,
              }}
            >
              <p className="font-mono text-xs text-textLight">
                {def.label} <span className="text-textDim">({buildings[type]})</span>
              </p>
              <p className="text-[10px] text-textDim">{def.effect}</p>
              <p className="text-[10px] mt-1" style={{ color: accentColor }}>
                {costLabel}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
