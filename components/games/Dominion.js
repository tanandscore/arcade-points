"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "@/lib/sound";

const HEX_SIZE = 2.1;
const ROUNDS = 12;
const AI_COLOR = 0xff3ea5;
const NEUTRAL_COLOR = 0x4a4568;
const MARKET_COST = 8;
const FORT_COST = 8;
const REINFORCE_COST = 3;

function axialToPixel(q, r) {
  const x = HEX_SIZE * 1.5 * q;
  const z = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, z };
}

const NEIGHBOR_OFFSETS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

function buildMap() {
  const tiles = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) {
      tiles.push({
        q, r, key: `${q},${r}`,
        resource: Math.random() < 0.32,
        owner: "neutral",
        troops: 2 + Math.floor(Math.random() * 3),
        fort: false,
        market: false,
      });
    }
  }
  tiles.forEach((t, i) => {
    t.label = String(i + 1);
  });
  const byKey = {};
  tiles.forEach((t) => (byKey[t.key] = t));
  const playerStart = tiles.reduce((best, t) => (t.q + t.r < best.q + best.r ? t : best));
  const aiStart = tiles.reduce((best, t) => (t.q + t.r > best.q + best.r ? t : best));
  playerStart.owner = "player";
  playerStart.troops = 6;
  aiStart.owner = "ai";
  aiStart.troops = 6;
  return { tiles, byKey };
}

function neighborsOf(byKey, tile) {
  return NEIGHBOR_OFFSETS.map(([dq, dr]) => byKey[`${tile.q + dq},${tile.r + dr}`]).filter(Boolean);
}

function combat(source, target) {
  const defense = target.troops * (target.fort ? 1.5 : 1);
  const winChance = source.troops / (source.troops + defense);
  if (Math.random() < winChance) {
    const moved = Math.ceil(source.troops / 2);
    source.troops = Math.floor(source.troops / 2);
    target.owner = source.owner;
    target.troops = moved;
    target.fort = false;
    target.market = false;
    return true;
  }
  source.troops = Math.max(1, source.troops - (1 + Math.floor(Math.random() * 3)));
  return false;
}

export default function Dominion({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [supported, setSupported] = useState(true);
  const [round, setRound] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState("Select one of your territories below to begin.");
  const [gold, setGold] = useState(6);
  const [, forceRender] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const mapRef = useRef(buildMap());
  const meshesRef = useRef({});
  const sceneRef = useRef(null);
  const frameRef = useRef(null);
  const finishedRef = useRef(false);
  const goldRef = useRef(6);

  function accentHex() {
    return new THREE.Color(accentColor || "#3ee6e0").getHex();
  }

  function colorForTile(tile) {
    if (tile.owner === "player") return accentHex();
    if (tile.owner === "ai") return AI_COLOR;
    return NEUTRAL_COLOR;
  }

  function refreshTileVisual(tile) {
    const mesh = meshesRef.current[tile.key];
    if (!mesh) return;
    mesh.material.color.setHex(colorForTile(tile));
    const isSelected = selected === tile.key;
    mesh.scale.y = tile.fort ? 1.9 : isSelected ? 1.5 : 1;
    mesh.position.y = isSelected ? 0.25 : 0;
  }

  function refreshAllVisuals() {
    mapRef.current.tiles.forEach(refreshTileVisual);
    forceRender((n) => n + 1);
  }

  function addGold(amount) {
    goldRef.current += amount;
    setGold(goldRef.current);
  }

  function finishGame() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGameOver(true);
    const playerTiles = mapRef.current.tiles.filter((t) => t.owner === "player");
    const resourceOwned = playerTiles.filter((t) => t.resource).length;
    const totalResourceTiles = mapRef.current.tiles.filter((t) => t.resource).length;
    const forts = playerTiles.filter((t) => t.fort).length;
    const markets = playerTiles.filter((t) => t.market).length;
    const totalTroops = playerTiles.reduce((s, t) => s + t.troops, 0);
    const aiEliminated = !mapRef.current.tiles.some((t) => t.owner === "ai");
    const economicVictory = totalResourceTiles > 0 && resourceOwned === totalResourceTiles;

    let score = playerTiles.length * 80 + resourceOwned * 100 + totalTroops * 3 + forts * 60 + markets * 60 + goldRef.current * 2;
    if (aiEliminated) score += 300;
    if (economicVictory) score += 200;

    setLog(
      aiEliminated
        ? "Victory! The AI is eliminated. +300 conquest bonus."
        : economicVictory
        ? "Every resource tile is yours! +200 economic bonus."
        : "Campaign complete."
    );
    setTimeout(() => onFinish(Math.max(0, score)), 900);
  }

  function aiTurn() {
    const map = mapRef.current;
    let aiGold = 6; // AI's own simplified gold pool, independent of the player's

    // Attack up to 3 times per round, preferring weakly defended
    // resource tiles over anything else.
    for (let i = 0; i < 3; i++) {
      const attackers = map.tiles.filter((t) => t.owner === "ai" && t.troops > 2);
      if (!attackers.length) break;
      let bestMove = null;
      for (const source of attackers) {
        const targets = neighborsOf(map.byKey, source).filter((t) => t.owner !== "ai");
        for (const target of targets) {
          const defense = target.troops * (target.fort ? 1.5 : 1);
          if (defense < source.troops * 0.95) {
            const score = (target.resource ? 100 : 0) - defense;
            if (!bestMove || score > bestMove.score) bestMove = { source, target, score };
          }
        }
      }
      if (!bestMove) break;
      combat(bestMove.source, bestMove.target);
    }

    // Spend gold: markets on resource tiles first, then forts on the
    // front line, then reinforce the weakest exposed tile.
    const aiTiles = () => map.tiles.filter((t) => t.owner === "ai");
    for (const t of aiTiles()) {
      if (t.resource && !t.market && aiGold >= MARKET_COST) {
        t.market = true;
        aiGold -= MARKET_COST;
      }
    }
    const frontline = () => aiTiles().filter((t) => neighborsOf(map.byKey, t).some((n) => n.owner !== "ai"));
    for (const t of frontline()) {
      if (!t.fort && aiGold >= FORT_COST) {
        t.fort = true;
        aiGold -= FORT_COST;
      }
    }
    let guard = 0;
    while (aiGold >= REINFORCE_COST && frontline().length && guard < 5) {
      const weakest = frontline().sort((a, b) => a.troops - b.troops)[0];
      weakest.troops += 2;
      aiGold -= REINFORCE_COST;
      guard += 1;
    }

    // Passive per-round growth for everyone
    let goldGain = 0;
    map.tiles.forEach((t) => {
      if (t.owner === "player" || t.owner === "ai") {
        t.troops += t.resource ? 2 : 1;
        const gain = (t.resource ? 3 : 1) + (t.market ? 2 : 0);
        if (t.owner === "player") goldGain += gain;
      }
    });
    addGold(goldGain);
    refreshAllVisuals();
  }

  function endRound() {
    if (gameOver) return;
    aiTurn();
    setSelected(null);
    const playerAlive = mapRef.current.tiles.some((t) => t.owner === "player");
    const aiAlive = mapRef.current.tiles.some((t) => t.owner === "ai");
    if (!playerAlive || !aiAlive || round >= ROUNDS) {
      if (!playerAlive) setLog("Defeated.");
      finishGame();
    } else {
      setRound((r) => r + 1);
      setLog("Your move — select a territory below.");
    }
  }

  function selectTile(key) {
    if (gameOver) return;
    const tile = mapRef.current.byKey[key];
    if (tile.owner !== "player") return;
    setSelected(key);
    sfx.select();
    refreshAllVisuals();
  }

  function attackFrom(sourceKey, targetKey) {
    const map = mapRef.current;
    const source = map.byKey[sourceKey];
    const target = map.byKey[targetKey];
    const won = combat(source, target);
    sfx[won ? "correct" : "wrong"]();
    setLog(won ? `Captured territory ${target.label}!` : `Attack on territory ${target.label} failed.`);
    setSelected(won ? null : sourceKey);
    refreshAllVisuals();
  }

  function reinforceSelected() {
    if (!selected || goldRef.current < REINFORCE_COST) return;
    const tile = mapRef.current.byKey[selected];
    tile.troops += 2;
    addGold(-REINFORCE_COST);
    sfx.correct();
    setLog(`Reinforced ${tile.label} (+2 troops).`);
    refreshAllVisuals();
  }

  function buildFort() {
    if (!selected || goldRef.current < FORT_COST) return;
    const tile = mapRef.current.byKey[selected];
    if (tile.fort) return;
    tile.fort = true;
    addGold(-FORT_COST);
    sfx.correct();
    setLog(`Fort built on ${tile.label} — defense boosted.`);
    refreshAllVisuals();
  }

  function buildMarket() {
    if (!selected || goldRef.current < MARKET_COST) return;
    const tile = mapRef.current.byKey[selected];
    if (tile.market || !tile.resource) return;
    tile.market = true;
    addGold(-MARKET_COST);
    sfx.correct();
    setLog(`Market built on ${tile.label} — gold income boosted.`);
    refreshAllVisuals();
  }

  // Runs after the canvas container has actually rendered. The 3D
  // view is deliberately non-interactive here — every action happens
  // through the buttons below, which is far more reliable than
  // raycasting against small hex tiles, especially on mobile.
  useEffect(() => {
    if (!started || !mountRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setSupported(false);
      return undefined;
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0720);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    const meshes = {};
    mapRef.current.tiles.forEach((tile) => {
      const { x, z } = axialToPixel(tile.q, tile.r);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(HEX_SIZE * 0.92, HEX_SIZE * 0.92, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: colorForTile(tile) })
      );
      mesh.position.set(x, 0, z);
      mesh.userData.key = tile.key;
      scene.add(mesh);
      meshes[tile.key] = mesh;

      if (tile.resource) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffb703, emissiveIntensity: 0.6 })
        );
        marker.position.set(x, 0.7, z);
        scene.add(marker);
      }
    });
    meshesRef.current = meshes;
    sceneRef.current = { renderer, scene, camera };

    let angle = 0;
    function animate() {
      // Slow cinematic orbit — purely visual, keeps the 3D map feeling
      // alive without needing any interaction on the canvas itself.
      angle += 0.0025;
      camera.position.set(Math.sin(angle) * 24, 24, Math.cos(angle) * 24);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!supported) {
    return (
      <p className="text-center text-textDim">
        Your browser doesn't support 3D graphics (WebGL). Try a different browser or device.
      </p>
    );
  }

  if (!started) {
    return (
      <div className="text-center">
        <h2 className="font-pixel text-[11px] mb-4 text-accentAmber">HOW TO PLAY</h2>
        <div className="text-left max-w-sm mx-auto mb-6 space-y-2 text-sm text-textDim">
          <p>🗺️ 19 territories. You and the AI each start with one. The rest are neutral.</p>
          <p>💰 Every territory earns you Troops and Gold each round — resource tiles (gold marker) earn more.</p>
          <p>⚔️ Attack: pick one of your territories below, then pick an adjacent enemy/neutral one to fight it — more troops means better odds.</p>
          <p>➕ Reinforce: spend {REINFORCE_COST} gold for +2 troops on a territory.</p>
          <p>🏰 Build a Fort ({FORT_COST}g): boosts that territory's defense by 50%.</p>
          <p>🏪 Build a Market ({MARKET_COST}g, resource tiles only): +2 gold per round from that tile.</p>
          <p>🏆 Extra points: eliminate the AI entirely (+300), capture every resource tile (+200), or simply out-build and out-grow them over {ROUNDS} rounds.</p>
        </div>
        <button onClick={() => setStarted(true)} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START CAMPAIGN
        </button>
      </div>
    );
  }

  const map = mapRef.current;
  const playerTiles = map.tiles.filter((t) => t.owner === "player");
  const aiTileCount = map.tiles.filter((t) => t.owner === "ai").length;
  const selectedTile = selected ? map.byKey[selected] : null;
  const attackTargets = selectedTile ? neighborsOf(map.byKey, selectedTile).filter((t) => t.owner !== "player") : [];

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-2 text-textDim">
        <span>Round {Math.min(round, ROUNDS)} / {ROUNDS}</span>
        <span>💰 <span className="text-textLight">{gold}</span></span>
        <span>
          You: <span style={{ color: accentColor }}>{playerTiles.length}</span> · AI:{" "}
          <span className="text-accentMagenta">{aiTileCount}</span>
        </span>
      </div>
      <p className="font-mono text-[11px] mb-3 h-8" style={{ color: accentColor }}>
        {log}
      </p>
      <div
        ref={mountRef}
        className="mx-auto rounded-lg overflow-hidden border border-lineColor mb-4"
        style={{ width: "min(92vw, 420px)", height: 220, background: "#0d0720" }}
      />

      <div className="text-left">
        <p className="font-mono text-[10px] text-textDim mb-1.5 uppercase tracking-wide">Your territories</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 mb-3">
          {playerTiles.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTile(t.key)}
              className="rounded-md border-2 py-2 font-mono text-[10px]"
              style={{
                borderColor: selected === t.key ? "#ffffff" : accentColor,
                background: "#241154",
                color: accentColor,
              }}
            >
              <div>{t.label}{t.fort ? " 🏰" : ""}{t.market ? " 🏪" : ""}</div>
              <div className="text-textDim">⚔️{t.troops}</div>
            </button>
          ))}
        </div>

        {selectedTile && (
          <div className="rounded-lg border border-lineColor p-3 bg-bgPanel mb-3">
            <p className="font-mono text-[10px] text-textDim mb-2">
              Territory {selectedTile.label} selected — {selectedTile.troops} troops
              {selectedTile.resource ? " · resource tile" : ""}
            </p>

            {attackTargets.length > 0 && (
              <>
                <p className="font-mono text-[9px] text-textDim mb-1">Attack:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attackTargets.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => attackFrom(selectedTile.key, t.key)}
                      className="rounded-md px-2.5 py-1.5 font-mono text-[10px] border"
                      style={{ borderColor: "#ff3ea5", color: "#ff3ea5" }}
                    >
                      {t.label} ({t.troops}{t.fort ? " 🏰" : ""})
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={reinforceSelected}
                disabled={gold < REINFORCE_COST}
                className="rounded-md px-2.5 py-1.5 font-mono text-[10px] border border-lineColor text-textLight disabled:opacity-40"
              >
                ➕ Reinforce ({REINFORCE_COST}g)
              </button>
              <button
                onClick={buildFort}
                disabled={gold < FORT_COST || selectedTile.fort}
                className="rounded-md px-2.5 py-1.5 font-mono text-[10px] border border-lineColor text-textLight disabled:opacity-40"
              >
                🏰 {selectedTile.fort ? "Fort built" : `Build Fort (${FORT_COST}g)`}
              </button>
              {selectedTile.resource && (
                <button
                  onClick={buildMarket}
                  disabled={gold < MARKET_COST || selectedTile.market}
                  className="rounded-md px-2.5 py-1.5 font-mono text-[10px] border border-lineColor text-textLight disabled:opacity-40"
                >
                  🏪 {selectedTile.market ? "Market built" : `Build Market (${MARKET_COST}g)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={endRound}
        disabled={gameOver}
        className="font-pixel text-[9px] px-5 py-2.5 rounded-md text-bgDeep disabled:opacity-50"
        style={{ background: accentColor }}
      >
        END ROUND ▸
      </button>
    </div>
  );
}
