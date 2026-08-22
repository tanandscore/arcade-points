"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MONSTERS = [
  { id: "wolf", name: "Dire Wolf", icon: "🐺", hp: 18, attack: 6, defense: 1, xp: 12, goldMin: 4, goldMax: 9, lootChance: 0.35 },
  { id: "skeleton", name: "Bone Skeleton", icon: "💀", hp: 22, attack: 7, defense: 2, xp: 15, goldMin: 5, goldMax: 11, lootChance: 0.4 },
  { id: "spider", name: "Cave Spider", icon: "🕷️", hp: 15, attack: 5, defense: 0, xp: 10, goldMin: 3, goldMax: 7, lootChance: 0.3 },
  { id: "goblin", name: "Goblin Raider", icon: "👺", hp: 25, attack: 8, defense: 2, xp: 18, goldMin: 6, goldMax: 13, lootChance: 0.45 },
];

const BOSS = {
  id: "boss",
  name: "The Hollow King",
  icon: "👑",
  hp: 90,
  attack: 14,
  defense: 5,
  xp: 100,
  goldMin: 40,
  goldMax: 70,
  lootChance: 1,
  guaranteedRarity: "epic",
};

const ITEM_POOL = [
  { id: "rusty-sword", name: "Rusty Sword", type: "weapon", rarity: "common", bonus: 2, icon: "🗡️" },
  { id: "iron-sword", name: "Iron Sword", type: "weapon", rarity: "rare", bonus: 5, icon: "⚔️" },
  { id: "flame-blade", name: "Flameforged Blade", type: "weapon", rarity: "epic", bonus: 9, icon: "🔥" },
  { id: "kings-edge", name: "Edge of the Hollow King", type: "weapon", rarity: "legendary", bonus: 15, icon: "🗡️" },
  { id: "leather-vest", name: "Leather Vest", type: "armor", rarity: "common", bonus: 2, icon: "🎽" },
  { id: "chainmail", name: "Chainmail", type: "armor", rarity: "rare", bonus: 5, icon: "🛡️" },
  { id: "shadow-plate", name: "Shadow Plate", type: "armor", rarity: "epic", bonus: 9, icon: "🖤" },
  { id: "kings-aegis", name: "Aegis of the Hollow King", type: "armor", rarity: "legendary", bonus: 15, icon: "🛡️" },
];

const RARITY_COLOR = { common: "#a99fd6", rare: "#3ee6e0", epic: "#b45cff", legendary: "#ffb703" };
const RARITY_WEIGHTS = [
  ["common", 0.55],
  ["rare", 0.3],
  ["epic", 0.12],
  ["legendary", 0.03],
];

function rollRarity() {
  const r = Math.random();
  let cumulative = 0;
  for (const [rarity, weight] of RARITY_WEIGHTS) {
    cumulative += weight;
    if (r <= cumulative) return rarity;
  }
  return "common";
}

function rollLoot(forcedRarity) {
  const rarity = forcedRarity || rollRarity();
  const pool = ITEM_POOL.filter((i) => i.rarity === rarity);
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { ...item, uid: `${item.id}-${Date.now()}-${Math.random()}` };
}

function xpForNextLevel(level) {
  return 30 + level * 20;
}

function rollQuest(level) {
  const kind = Math.random() < 0.5 ? "kill" : "collect";
  if (kind === "kill") {
    const monster = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    const count = 2 + Math.floor(level / 2);
    return {
      kind: "kill",
      targetId: monster.id,
      targetName: monster.name,
      count,
      progress: 0,
      rewardGold: count * 10,
      rewardXp: count * 8,
      completed: false,
    };
  }
  const count = 2 + Math.floor(level / 3);
  return {
    kind: "collect",
    targetName: "loot items",
    count,
    progress: 0,
    rewardGold: count * 12,
    rewardXp: count * 8,
    completed: false,
  };
}

export default function Duskward({ onFinish, accentColor }) {
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("town");
  const [monster, setMonster] = useState(null);
  const [monsterHp, setMonsterHp] = useState(0);
  const [combatLog, setCombatLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const characterRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/rpg/character");
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      setLoading(false);
    })();
  }, []);

  function save(updated) {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await fetch("/api/rpg/character", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    }, 400);
  }

  function applyUpdate(patch) {
    setCharacter((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }

  async function createCharacter() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Enter a name for your character.");
      return;
    }
    setError("");
    const res = await fetch("/api/rpg/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't create your character.");
      return;
    }
    setCharacter(data.character);
    sfx.newBest();
  }

  function effectiveAttack(c) {
    return c.base_attack + (c.equipped_weapon?.bonus || 0);
  }
  function effectiveDefense(c) {
    return c.base_defense + (c.equipped_armor?.bonus || 0);
  }

  function startEncounter(useBoss) {
    const template = useBoss ? BOSS : MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    setMonster(template);
    setMonsterHp(template.hp);
    setCombatLog(`A ${template.name} appears!`);
    setPhase("combat");
  }

  function grantLoot(forcedRarity) {
    const item = rollLoot(forcedRarity);
    const nextInventory = [...(characterRef.current.inventory || []), item];
    return { item, nextInventory };
  }

  function updateQuestProgress(c, kind, monsterId) {
    const quests = [...(c.quests || [])];
    const active = quests[quests.length - 1];
    if (!active || active.completed) return quests;
    if (kind === "kill" && active.kind === "kill" && active.targetId === monsterId) {
      active.progress = Math.min(active.count, active.progress + 1);
    }
    if (kind === "collect" && active.kind === "collect") {
      active.progress = Math.min(active.count, active.progress + 1);
    }
    return quests;
  }

  function playerAttack() {
    if (busy || !monster) return;
    setBusy(true);
    const c = characterRef.current;
    const dmgToMonster = Math.max(1, effectiveAttack(c) + Math.floor(Math.random() * 4) - monster.defense);
    const newMonsterHp = Math.max(0, monsterHp - dmgToMonster);
    setMonsterHp(newMonsterHp);
    sfx.hit();
    haptics.tap();

    if (newMonsterHp <= 0) {
      resolveVictory();
      setBusy(false);
      return;
    }

    const dmgToPlayer = Math.max(1, monster.attack + Math.floor(Math.random() * 3) - effectiveDefense(c));
    const newHp = Math.max(0, c.hp - dmgToPlayer);
    setCombatLog(`You hit for ${dmgToMonster}. ${monster.name} hits back for ${dmgToPlayer}.`);
    applyUpdate({ hp: newHp });

    if (newHp <= 0) {
      resolveDefeat();
    }
    setBusy(false);
  }

  function resolveVictory() {
    const c = characterRef.current;
    sfx.win();
    haptics.success();
    const goldWon = monster.goldMin + Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1));
    let nextXp = c.xp + monster.xp;
    let nextLevel = c.level;
    let nextMaxHp = c.max_hp;
    let nextAttack = c.base_attack;
    let nextDefense = c.base_defense;
    let didLevelUp = false;

    while (nextXp >= xpForNextLevel(nextLevel)) {
      nextXp -= xpForNextLevel(nextLevel);
      nextLevel += 1;
      nextMaxHp += 8;
      nextAttack += 2;
      nextDefense += 1;
      didLevelUp = true;
    }

    let nextInventory = c.inventory || [];
    let lootMsg = "";
    const wonLoot = Math.random() < monster.lootChance;
    if (wonLoot) {
      const { item, nextInventory: inv } = grantLoot(monster.guaranteedRarity);
      nextInventory = inv;
      lootMsg = ` Found ${item.name}!`;
    }

    const quests = updateQuestProgress(c, "kill", monster.id);
    if (wonLoot) updateQuestProgress({ ...c, quests }, "collect", null);

    const patch = {
      xp: nextXp,
      level: nextLevel,
      max_hp: nextMaxHp,
      hp: didLevelUp ? nextMaxHp : c.hp,
      base_attack: nextAttack,
      base_defense: nextDefense,
      gold: c.gold + goldWon,
      inventory: nextInventory,
      quests,
    };
    applyUpdate(patch);
    setCombatLog(`Victory! +${monster.xp} XP, +${goldWon} gold.${lootMsg}`);

    if (didLevelUp) {
      sfx.levelUp();
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 1200);
    }

    setTimeout(() => {
      setPhase("town");
      setMonster(null);
    }, 1400);
  }

  function resolveDefeat() {
    sfx.lose();
    const c = characterRef.current;
    const goldLost = Math.min(c.gold, Math.floor(c.gold * 0.15));
    applyUpdate({ hp: 1, gold: c.gold - goldLost });
    setCombatLog(`You were defeated and limp back to town, ${goldLost} gold lighter.`);
    setTimeout(() => {
      setPhase("town");
      setMonster(null);
    }, 1600);
  }

  function flee() {
    if (busy) return;
    sfx.select();
    setCombatLog("You fled back to town.");
    setTimeout(() => {
      setPhase("town");
      setMonster(null);
    }, 500);
  }

  function equipItem(item) {
    const key = item.type === "weapon" ? "equipped_weapon" : "equipped_armor";
    sfx.correct();
    applyUpdate({ [key]: item });
  }

  function acceptNewQuest() {
    const c = characterRef.current;
    const quests = [...(c.quests || []), rollQuest(c.level)];
    sfx.select();
    applyUpdate({ quests });
  }

  function claimQuestReward() {
    const c = characterRef.current;
    const quests = [...(c.quests || [])];
    const active = quests[quests.length - 1];
    if (!active || active.progress < active.count || active.completed) return;
    active.completed = true;
    sfx.newBest();
    haptics.celebrate();
    applyUpdate({ gold: c.gold + active.rewardGold, xp: c.xp + active.rewardXp, quests });
  }

  function endSession() {
    const c = characterRef.current;
    save(c);
    onFinish(Math.round(c.gold + c.level * 25));
  }

  if (loading) {
    return <p className="text-center text-textDim py-10">Entering Duskward…</p>;
  }

  if (!character) {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🗡️</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">CREATE YOUR CHARACTER</p>
        <p className="text-textDim text-sm mb-6">
          This character is yours forever — your level, gold, gear, and quests are saved every time you play.
        </p>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Character name"
          className="w-full rounded-md px-3 py-2.5 mb-3 outline-none font-mono text-sm text-center bg-bgDeep border border-lineColor text-textLight"
        />
        {error && <p className="text-accentMagenta text-xs mb-3">{error}</p>}
        <button
          onClick={createCharacter}
          className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep"
          style={{ background: accentColor }}
        >
          BEGIN
        </button>
      </div>
    );
  }

  const activeQuest = (character.quests || [])[character.quests.length - 1];

  return (
    <div className="text-center relative max-w-md mx-auto">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL UP! Lv.{character.level}</p>
        </div>
      )}

      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>{character.name} · Lv.{character.level}</span>
        <span>🪙 {character.gold}</span>
      </div>

      <div className="mb-4">
        <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(character.hp / character.max_hp) * 100}%`, background: character.hp < character.max_hp * 0.3 ? "#ff3ea5" : accentColor }} />
        </div>
        <p className="font-mono text-[10px] text-textDim mt-1">HP {character.hp}/{character.max_hp} · XP {character.xp}/{xpForNextLevel(character.level)}</p>
      </div>

      {phase === "town" && (
        <div>
          <p className="text-textDim text-sm mb-6">The town square is quiet. Where to?</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => startEncounter(false)} className="py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>
              🌲 EXPLORE FOREST
            </button>
            <button
              onClick={() => startEncounter(true)}
              disabled={character.level < 5}
              className="py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-40"
              style={{ background: "#ffb703" }}
            >
              👑 {character.level < 5 ? "BOSS (Lv.5+)" : "FACE THE HOLLOW KING"}
            </button>
            <button onClick={() => setPhase("inventory")} className="py-3 rounded-md border border-lineColor font-mono text-xs">
              🎒 Inventory
            </button>
            <button onClick={() => setPhase("quests")} className="py-3 rounded-md border border-lineColor font-mono text-xs">
              📜 Quests
            </button>
          </div>
          <button onClick={endSession} className="font-mono text-[11px] text-textDim underline">
            Save &amp; return to Arcade
          </button>
        </div>
      )}

      {phase === "combat" && monster && (
        <div>
          <div className="mb-4">
            <p className="text-3xl mb-1">{monster.icon}</p>
            <p className="font-pixel text-[11px] text-textLight mb-2">{monster.name}</p>
            <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden max-w-[220px] mx-auto">
              <div className="h-full bg-accentMagenta" style={{ width: `${(monsterHp / monster.hp) * 100}%` }} />
            </div>
          </div>
          <p className="font-mono text-[11px] mb-4 h-8 text-textDim">{combatLog}</p>
          <div className="flex justify-center gap-2">
            <button onClick={playerAttack} disabled={busy} className="px-6 py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-50" style={{ background: accentColor }}>
              ATTACK
            </button>
            <button onClick={flee} disabled={busy} className="px-6 py-3 rounded-md border border-lineColor font-mono text-xs disabled:opacity-50">
              Flee
            </button>
          </div>
        </div>
      )}

      {phase === "inventory" && (
        <div>
          <p className="font-pixel text-[10px] text-accentAmber mb-3">INVENTORY</p>
          <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[10px] text-textDim">
            <p>Weapon: {character.equipped_weapon ? character.equipped_weapon.name : "None"}</p>
            <p>Armor: {character.equipped_armor ? character.equipped_armor.name : "None"}</p>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
            {(character.inventory || []).length === 0 && <p className="text-textDim text-xs">No items yet — explore the forest to find loot.</p>}
            {(character.inventory || []).map((item) => (
              <div key={item.uid} className="flex items-center justify-between rounded-md border border-lineColor px-3 py-2">
                <span className="font-mono text-xs flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span style={{ color: RARITY_COLOR[item.rarity] }}>{item.name}</span>
                  <span className="text-textDim">+{item.bonus}</span>
                </span>
                <button onClick={() => equipItem(item)} className="font-mono text-[10px] px-2 py-1 rounded border border-lineColor">
                  Equip
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setPhase("town")} className="font-mono text-[11px] text-textDim underline">
            ← Back to town
          </button>
        </div>
      )}

      {phase === "quests" && (
        <div>
          <p className="font-pixel text-[10px] text-accentAmber mb-3">QUEST GIVER</p>
          {!activeQuest || activeQuest.completed ? (
            <div>
              <p className="text-textDim text-sm mb-4">"Something always needs doing around here."</p>
              <button onClick={acceptNewQuest} className="font-pixel text-[10px] px-5 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
                Accept a quest
              </button>
            </div>
          ) : (
            <div>
              <p className="font-mono text-xs text-textLight mb-2">
                {activeQuest.kind === "kill"
                  ? `Kill ${activeQuest.count} ${activeQuest.targetName}`
                  : `Find ${activeQuest.count} loot items`}
              </p>
              <p className="font-mono text-[11px] text-textDim mb-4">
                Progress: {activeQuest.progress}/{activeQuest.count} · Reward: {activeQuest.rewardGold} gold, {activeQuest.rewardXp} XP
              </p>
              <button
                onClick={claimQuestReward}
                disabled={activeQuest.progress < activeQuest.count}
                className="font-pixel text-[10px] px-5 py-3 rounded-md text-bgDeep disabled:opacity-40"
                style={{ background: accentColor }}
              >
                {activeQuest.progress >= activeQuest.count ? "Claim reward" : "In progress…"}
              </button>
            </div>
          )}
          <div className="mt-4">
            <button onClick={() => setPhase("town")} className="font-mono text-[11px] text-textDim underline">
              ← Back to town
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
