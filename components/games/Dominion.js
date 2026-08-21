"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "@/lib/sound";

const HEX_SIZE = 2.1;
const ROUNDS = 10;
const AI_COLOR = 0xff3ea5;
const NEUTRAL_COLOR = 0x4a4568;

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
        q,
        r,
        key: `${q},${r}`,
        resource: Math.random() < 0.3,
        owner: "neutral",
        troops: 2 + Math.floor(Math.random() * 3),
      });
    }
  }
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

export default function Dominion({ onFinish, accentColor }) {
  const mountRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [supported, setSupported] = useState(true);
  const [round, setRound] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState("Select one of your territories to begin.");
  const [tileCounts, setTileCounts] = useState({ player: 1, ai: 1 });
  const [gameOver, setGameOver] = useState(false);

  const mapRef = useRef(buildMap());
  const meshesRef = useRef({});
  const sceneRef = useRef(null);
  const frameRef = useRef(null);
  const finishedRef = useRef(false);
  const selectedRef = useRef(null);

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
    const isSelected = selectedRef.current === tile.key;
    mesh.scale.y = isSelected ? 1.6 : 1;
    mesh.position.y = isSelected ? 0.25 : 0;
  }

  function refreshAllVisuals() {
    mapRef.current.tiles.forEach(refreshTileVisual);
    const player = mapRef.current.tiles.filter((t) => t.owner === "player").length;
    const ai = mapRef.current.tiles.filter((t) => t.owner === "ai").length;
    setTileCounts({ player, ai });
  }

  function finishGame() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGameOver(true);
    const playerTiles = mapRef.current.tiles.filter((t) => t.owner === "player");
    const resourceOwned = playerTiles.filter((t) => t.resource).length;
    const totalTroops = playerTiles.reduce((s, t) => s + t.troops, 0);
    const score = playerTiles.length * 80 + resourceOwned * 100 + totalTroops * 3;
    setTimeout(() => onFinish(Math.max(0, score)), 900);
  }

  function combat(source, target) {
    const winChance = source.troops / (source.troops + target.troops);
    if (Math.random() < winChance) {
      const moved = Math.ceil(source.troops / 2);
      source.troops = Math.floor(source.troops / 2);
      target.owner = source.owner;
      target.troops = moved;
      return true;
    } else {
      source.troops = Math.max(1, source.troops - (1 + Math.floor(Math.random() * 3)));
      return false;
    }
  }

  function aiTurn() {
    const map = mapRef.current;
    for (let i = 0; i < 2; i++) {
      const attackers = map.tiles.filter((t) => t.owner === "ai" && t.troops > 2);
      if (!attackers.length) break;
      const source = attackers[Math.floor(Math.random() * attackers.length)];
      const targets = neighborsOf(map.byKey, source).filter((t) => t.owner !== "ai" && t.troops < source.troops);
      if (!targets.length) continue;
      const target = targets.sort((a, b) => a.troops - b.troops)[0];
      combat(source, target);
    }
    map.tiles.forEach((t) => {
      if (t.owner === "player" || t.owner === "ai") {
        t.troops += t.resource ? 2 : 1;
      }
    });
    refreshAllVisuals();
  }

  function endRound() {
    if (gameOver) return;
    aiTurn();
    setSelected(null);
    selectedRef.current = null;
    const playerAlive = mapRef.current.tiles.some((t) => t.owner === "player");
    const aiAlive = mapRef.current.tiles.some((t) => t.owner === "ai");
    if (!playerAlive || !aiAlive || round >= ROUNDS) {
      setLog(!playerAlive ? "Defeated." : !aiAlive ? "Victory! The AI is eliminated." : "Campaign complete.");
      finishGame();
    } else {
      setRound((r) => r + 1);
      setLog("Your move — select a territory.");
    }
  }

  function handleTileClick(key) {
    if (gameOver) return;
    const map = mapRef.current;
    const tile = map.byKey[key];
    if (!selectedRef.current) {
      if (tile.owner === "player" && tile.troops > 1) {
        selectedRef.current = key;
        setSelected(key);
        refreshTileVisual(tile);
        setLog(`Selected (${tile.q},${tile.r}). Tap an adjacent territory to attack.`);
      }
      return;
    }
    const source = map.byKey[selectedRef.current];
    if (key === selectedRef.current) {
      selectedRef.current = null;
      setSelected(null);
      refreshTileVisual(source);
      return;
    }
    const isNeighbor = neighborsOf(map.byKey, source).some((n) => n.key === key);
    if (!isNeighbor || tile.owner === "player") {
      setLog("You can only attack an adjacent enemy or neutral territory.");
      return;
    }
    const won = combat(source, tile);
    sfx[won ? "correct" : "wrong"]();
    setLog(won ? `Captured (${tile.q},${tile.r})!` : `Attack on (${tile.q},${tile.r}) failed.`);
    selectedRef.current = null;
    setSelected(null);
    refreshTileVisual(source);
    refreshTileVisual(tile);
    setTileCounts({
      player: map.tiles.filter((t) => t.owner === "player").length,
      ai: map.tiles.filter((t) => t.owner === "ai").length,
    });
  }

  function begin() {
    if (!mountRef.current) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setSupported(false);
      return;
    }
    setStarted(true);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12092b);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(0, 26, 20);
    camera.lookAt(0, 0, 0);

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

    function handlePointer(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = e.touches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.touches ? e.changedTouches[0].clientY : e.clientY;
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(Object.values(meshes));
      if (hits.length) handleTileClick(hits[0].object.userData.key);
    }
    renderer.domElement.addEventListener("click", handlePointer);
    renderer.domElement.addEventListener("touchend", handlePointer);

    function animate() {
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    sceneRef.current.cleanup = () => {
      renderer.domElement.removeEventListener("click", handlePointer);
      renderer.domElement.removeEventListener("touchend", handlePointer);
    };
  }

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (sceneRef.current) {
        sceneRef.current.cleanup?.();
        const { renderer, scene } = sceneRef.current;
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

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
        <p className="mb-6 text-textDim">
          A 19-territory map. Tap your own territory, then an adjacent one to attack. Hold resource tiles (gold
          markers) for faster growth, or push toward the enemy — {ROUNDS} rounds, most territory and troops wins.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START CAMPAIGN
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-2 text-textDim">
        <span>Round {Math.min(round, ROUNDS)} / {ROUNDS}</span>
        <span>
          You: <span style={{ color: accentColor }}>{tileCounts.player}</span> · AI:{" "}
          <span className="text-accentMagenta">{tileCounts.ai}</span>
        </span>
      </div>
      <p className="font-mono text-[11px] mb-3 h-8" style={{ color: accentColor }}>
        {log}
      </p>
      <div
        ref={mountRef}
        className="mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(92vw, 420px)", height: 300, background: "#12092b" }}
      />
      <button
        onClick={endRound}
        disabled={gameOver}
        className="font-pixel text-[9px] px-5 py-2.5 rounded-md text-bgDeep mt-4 disabled:opacity-50"
        style={{ background: accentColor }}
      >
        END ROUND ▸
      </button>
    </div>
  );
}
