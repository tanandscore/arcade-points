"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MONSTERS = [
  { id: "wolf", name: "Dire Wolf", icon: "🐺", hp: 18, attack: 6, defense: 1, xp: 12, goldMin: 4, goldMax: 9, lootChance: 0.35 },
  { id: "spider", name: "Cave Spider", icon: "🕷️", hp: 15, attack: 5, defense: 0, xp: 10, goldMin: 3, goldMax: 7, lootChance: 0.3 },
  { id: "skeleton", name: "Bone Skeleton", icon: "💀", hp: 22, attack: 7, defense: 2, xp: 15, goldMin: 5, goldMax: 11, lootChance: 0.4 },
  { id: "goblin", name: "Goblin Raider", icon: "👺", hp: 25, attack: 8, defense: 2, xp: 18, goldMin: 6, goldMax: 13, lootChance: 0.45 },
  { id: "wraith", name: "Marsh Wraith", icon: "👻", hp: 32, attack: 10, defense: 3, xp: 26, goldMin: 10, goldMax: 18, lootChance: 0.5 },
  { id: "troll", name: "Bog Troll", icon: "🧌", hp: 40, attack: 11, defense: 4, xp: 32, goldMin: 12, goldMax: 22, lootChance: 0.55 },
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

const ZONES = [
  { id: "forest", name: "Whispering Woods", icon: "🌲", minLevel: 1, monsterIds: ["wolf", "spider"] },
  { id: "crypt", name: "Bonevale Crypt", icon: "⚰️", minLevel: 3, monsterIds: ["skeleton", "goblin"] },
  { id: "marsh", name: "Shadowfen Marsh", icon: "🌫️", minLevel: 6, monsterIds: ["wraith", "troll"] },
];

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

const MAX_ACTIVE_QUESTS = 2;
const POWER_STRIKE_COST = 6;
const SECOND_WIND_COST = 8;

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

function findMonster(id) {
  return MONSTERS.find((m) => m.id === id);
}

function rollQuest(level) {
  const kind = Math.random() < 0.5 ? "kill" : "collect";
  if (kind === "kill") {
    const monster = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    const count = 2 + Math.floor(level / 2);
    return {
      id: `${Date.now()}-${Math.random()}`,
      kind: "kill",
      targetId: monster.id,
      targetName: monster.name,
      count,
      progress: 0,
      rewardGold: count * 10,
      rewardXp: count * 8,
      active: true,
      completed: false,
    };
  }
  const count = 2 + Math.floor(level / 3);
  return {
    id: `${Date.now()}-${Math.random()}`,
    kind: "collect",
    targetName: "loot items",
    count,
    progress: 0,
    rewardGold: count * 12,
    rewardXp: count * 8,
    active: true,
    completed: false,
  };
}

export default function Duskward({ onFinish, accentColor }) {
  const [loading, setLoading] = useState(true);
  const [deviceOk, setDeviceOk] = useState(null);
  const [entered, setEntered] = useState(false);
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
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/rpg/character");
      const data = await res.json();
      if (data.character) setCharacter(data.character);
      setLoading(false);
    })();
  }, []);

  function enterFullscreenAndProceed() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    setEntered(true);
  }

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
    // Fullscreen must be requested synchronously within the click,
    // before any await — otherwise some browsers (Safari especially)
    // no longer consider it a trusted user gesture and silently
    // refuse.
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
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
    setEntered(true);
    sfx.newBest();
  }

  function effectiveAttack(c) {
    return c.base_attack + (c.equipped_weapon?.bonus || 0);
  }
  function effectiveDefense(c) {
    return c.base_defense + (c.equipped_armor?.bonus || 0);
  }

  function startEncounter(zone, useBoss) {
    const template = useBoss
      ? BOSS
      : findMonster(zone.monsterIds[Math.floor(Math.random() * zone.monsterIds.length)]);
    setMonster(template);
    setMonsterHp(template.hp);
    setCombatLog(`A ${template.name} appears in ${zone.name}!`);
    applyUpdate({ stamina: characterRef.current.max_stamina });
    setPhase("combat");
  }

  function grantLoot(forcedRarity) {
    const item = rollLoot(forcedRarity);
    const nextInventory = [...(characterRef.current.inventory || []), item];
    return { item, nextInventory };
  }

  function updateQuestProgress(c, kind, monsterId) {
    return (c.quests || []).map((q) => {
      if (!q.active || q.completed) return q;
      if (kind === "kill" && q.kind === "kill" && q.targetId === monsterId) {
        return { ...q, progress: Math.min(q.count, q.progress + 1) };
      }
      if (kind === "collect" && q.kind === "collect") {
        return { ...q, progress: Math.min(q.count, q.progress + 1) };
      }
      return q;
    });
  }

  function monsterRetaliate(c) {
    const dmgToPlayer = Math.max(1, monster.attack + Math.floor(Math.random() * 3) - effectiveDefense(c));
    const newHp = Math.max(0, c.hp - dmgToPlayer);
    return { dmgToPlayer, newHp };
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

    const { dmgToPlayer, newHp } = monsterRetaliate(c);
    setCombatLog(`You hit for ${dmgToMonster}. ${monster.name} hits back for ${dmgToPlayer}.`);
    applyUpdate({ hp: newHp });
    if (newHp <= 0) resolveDefeat();
    setBusy(false);
  }

  function powerStrike() {
    if (busy || !monster) return;
    const c = characterRef.current;
    if (c.stamina < POWER_STRIKE_COST) return;
    setBusy(true);
    applyUpdate({ stamina: c.stamina - POWER_STRIKE_COST });
    const dmgToMonster = Math.max(2, Math.round((effectiveAttack(c) + Math.floor(Math.random() * 4)) * 1.8) - monster.defense);
    const newMonsterHp = Math.max(0, monsterHp - dmgToMonster);
    setMonsterHp(newMonsterHp);
    sfx.boost();
    haptics.success();

    if (newMonsterHp <= 0) {
      resolveVictory();
      setBusy(false);
      return;
    }

    const { dmgToPlayer, newHp } = monsterRetaliate(c);
    setCombatLog(`POWER STRIKE for ${dmgToMonster}! ${monster.name} hits back for ${dmgToPlayer}.`);
    applyUpdate({ hp: newHp });
    if (newHp <= 0) resolveDefeat();
    setBusy(false);
  }

  function secondWind() {
    if (busy || !monster) return;
    const c = characterRef.current;
    if (c.stamina < SECOND_WIND_COST) return;
    setBusy(true);
    const healed = Math.round((c.max_hp - c.hp) * 0.3) + Math.round(c.max_hp * 0.1);
    const healedHp = Math.min(c.max_hp, c.hp + healed);
    sfx.select();

    const { dmgToPlayer, newHp } = monsterRetaliate({ ...c, hp: healedHp });
    setCombatLog(`Second Wind! Recovered ${healed} HP. ${monster.name} hits for ${dmgToPlayer}.`);
    applyUpdate({ hp: newHp, stamina: c.stamina - SECOND_WIND_COST });
    if (newHp <= 0) resolveDefeat();
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
    let nextMaxStamina = c.max_stamina;
    let nextAttack = c.base_attack;
    let nextDefense = c.base_defense;
    let didLevelUp = false;

    while (nextXp >= xpForNextLevel(nextLevel)) {
      nextXp -= xpForNextLevel(nextLevel);
      nextLevel += 1;
      nextMaxHp += 8;
      nextMaxStamina += 2;
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

    let quests = updateQuestProgress(c, "kill", monster.id);
    if (wonLoot) quests = updateQuestProgress({ ...c, quests }, "collect", null);

    const patch = {
      xp: nextXp,
      level: nextLevel,
      max_hp: nextMaxHp,
      hp: didLevelUp ? nextMaxHp : c.hp,
      max_stamina: nextMaxStamina,
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
    const activeCount = (c.quests || []).filter((q) => q.active && !q.completed).length;
    if (activeCount >= MAX_ACTIVE_QUESTS) return;
    const quests = [...(c.quests || []), rollQuest(c.level)];
    sfx.select();
    applyUpdate({ quests });
  }

  function claimQuestReward(questId) {
    const c = characterRef.current;
    const quest = (c.quests || []).find((q) => q.id === questId);
    if (!quest || quest.progress < quest.count || quest.completed) return;
    const quests = c.quests.map((q) => (q.id === questId ? { ...q, completed: true, active: false } : q));
    sfx.newBest();
    haptics.celebrate();
    applyUpdate({ gold: c.gold + quest.rewardGold, xp: c.xp + quest.rewardXp, quests });
  }

  function endSession() {
    const c = characterRef.current;
    save(c);
    onFinish(Math.round(c.gold + c.level * 25));
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Duskward is built for laptop and desktop play. Please switch to a larger screen to enter the world.
        </p>
      </div>
    );
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

  if (!entered) {
    return (
      <div className="text-center max-w-sm mx-auto py-8">
        <p className="text-3xl mb-4">🗡️</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">WELCOME BACK, {character.name.toUpperCase()}</p>
        <p className="text-textDim text-sm mb-6">Lv.{character.level} · 🪙 {character.gold}</p>
        <button onClick={enterFullscreenAndProceed} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          ENTER DUSKWARD
        </button>
      </div>
    );
  }

  const activeQuests = (character.quests || []).filter((q) => q.active);
  const canAcceptQuest = activeQuests.filter((q) => !q.completed).length < MAX_ACTIVE_QUESTS;

  return (
    <div className="text-center relative max-w-md mx-auto">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL UP! Lv.{character.level}</p>
        </div>
      )}

      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
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
          <p className="text-textDim text-sm mb-4">The town square is quiet. Where to?</p>
          <div className="space-y-2 mb-4">
            {ZONES.map((zone) => {
              const locked = character.level < zone.minLevel;
              return (
                <button
                  key={zone.id}
                  onClick={() => !locked && startEncounter(zone, false)}
                  disabled={locked}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-md border font-mono text-xs disabled:opacity-40"
                  style={{ borderColor: locked ? undefined : accentColor }}
                >
                  <span>{zone.icon} {zone.name}</span>
                  <span className="text-textDim">{locked ? `Lv.${zone.minLevel}+` : "Enter"}</span>
                </button>
              );
            })}
            <button
              onClick={() => startEncounter(ZONES[0], true)}
              disabled={character.level < 5}
              className="w-full py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-40"
              style={{ background: "#ffb703" }}
            >
              👑 {character.level < 5 ? "THE HOLLOW KING (Lv.5+)" : "FACE THE HOLLOW KING"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setPhase("inventory")} className="py-3 rounded-md border border-lineColor font-mono text-xs">
              🎒 Inventory
            </button>
            <button onClick={() => setPhase("quests")} className="py-3 rounded-md border border-lineColor font-mono text-xs">
              📜 Quests {activeQuests.filter((q) => !q.completed).length > 0 && `(${activeQuests.filter((q) => !q.completed).length})`}
            </button>
          </div>
          <button onClick={endSession} className="font-mono text-[11px] text-textDim underline">
            Save &amp; return to Arcade
          </button>
        </div>
      )}

      {phase === "combat" && monster && (
        <div>
          <div className="mb-3">
            <p className="text-3xl mb-1">{monster.icon}</p>
            <p className="font-pixel text-[11px] text-textLight mb-2">{monster.name}</p>
            <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden max-w-[220px] mx-auto">
              <div className="h-full bg-accentMagenta" style={{ width: `${(monsterHp / monster.hp) * 100}%` }} />
            </div>
          </div>
          <div className="max-w-[220px] mx-auto mb-3">
            <div className="h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
              <div className="h-full bg-accentCyan" style={{ width: `${(character.stamina / character.max_stamina) * 100}%` }} />
            </div>
            <p className="font-mono text-[9px] text-textDim mt-0.5">Stamina {character.stamina}/{character.max_stamina}</p>
          </div>
          <p className="font-mono text-[11px] mb-4 h-8 text-textDim">{combatLog}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={playerAttack} disabled={busy} className="py-3 rounded-md font-pixel text-[10px] text-bgDeep disabled:opacity-50" style={{ background: accentColor }}>
              ATTACK
            </button>
            <button
              onClick={powerStrike}
              disabled={busy || character.stamina < POWER_STRIKE_COST}
              className="py-3 rounded-md font-pixel text-[9px] text-bgDeep disabled:opacity-40"
              style={{ background: "#ff3ea5" }}
            >
              POWER STRIKE ({POWER_STRIKE_COST})
            </button>
            <button
              onClick={secondWind}
              disabled={busy || character.stamina < SECOND_WIND_COST}
              className="py-3 rounded-md border font-mono text-[10px] disabled:opacity-40"
              style={{ borderColor: "#3ee6e0", color: "#3ee6e0" }}
            >
              SECOND WIND ({SECOND_WIND_COST})
            </button>
            <button onClick={flee} disabled={busy} className="py-3 rounded-md border border-lineColor font-mono text-xs disabled:opacity-50">
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
            {(character.inventory || []).length === 0 && <p className="text-textDim text-xs">No items yet — explore a zone to find loot.</p>}
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
          <p className="font-pixel text-[10px] text-accentAmber mb-3">QUEST LOG ({activeQuests.filter((q) => !q.completed).length}/{MAX_ACTIVE_QUESTS})</p>
          {activeQuests.length === 0 && <p className="text-textDim text-sm mb-4">"Something always needs doing around here."</p>}
          <div className="space-y-3 mb-4">
            {activeQuests.map((q) => (
              <div key={q.id} className="rounded-md border border-lineColor p-3 text-left">
                <p className="font-mono text-xs text-textLight mb-1">
                  {q.kind === "kill" ? `Kill ${q.count} ${q.targetName}` : `Find ${q.count} loot items`}
                </p>
                <p className="font-mono text-[10px] text-textDim mb-2">
                  Progress: {q.progress}/{q.count} · Reward: {q.rewardGold} gold, {q.rewardXp} XP
                </p>
                <button
                  onClick={() => claimQuestReward(q.id)}
                  disabled={q.completed || q.progress < q.count}
                  className="font-pixel text-[9px] px-4 py-2 rounded-md text-bgDeep disabled:opacity-40"
                  style={{ background: accentColor }}
                >
                  {q.completed ? "Claimed" : q.progress >= q.count ? "Claim reward" : "In progress…"}
                </button>
              </div>
            ))}
          </div>
          {canAcceptQuest && (
            <button onClick={acceptNewQuest} className="font-pixel text-[10px] px-5 py-3 rounded-md text-bgDeep mb-4" style={{ background: accentColor }}>
              Accept a new quest
            </button>
          )}
          <div>
            <button onClick={() => setPhase("town")} className="font-mono text-[11px] text-textDim underline">
              ← Back to town
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
