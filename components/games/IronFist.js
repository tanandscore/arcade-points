"use client";

import { useState } from "react";
import { sfx } from "@/lib/sound";

const MAX_HP = 100;
const ROUNDS_TO_WIN = 2;
const BASE_DAMAGE = 14;
const FINISHER_DAMAGE = 40;
const COMBO_TO_FINISH = 4;

function beats(a, b) {
  return (a === "High" && b === "Low") || (a === "Low" && b === "Mid") || (a === "Mid" && b === "High");
}

export default function IronFist({ onFinish, accentColor }) {
  const [myHp, setMyHp] = useState(MAX_HP);
  const [aiHp, setAiHp] = useState(MAX_HP);
  const [myWins, setMyWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [log, setLog] = useState("Pick your stance for the next exchange.");
  const [gameOver, setGameOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [finishReady, setFinishReady] = useState(false);

  function begin() {
    setStarted(true);
  }

  function finishMatch(finalMyWins, finalAiWins, finalMyHp) {
    const won = finalMyWins > finalAiWins;
    sfx[won ? "newBest" : "lose"]();
    const score = finalMyWins * 200 + Math.round((finalMyHp / MAX_HP) * 100);
    setTimeout(() => onFinish(Math.max(0, score)), 900);
  }

  function newRound() {
    setMyHp(MAX_HP);
    setAiHp(MAX_HP);
    setCombo(0);
    setFinishReady(false);
  }

  function exchange(stance) {
    if (busy || gameOver) return;
    setBusy(true);
    const aiStance = ["High", "Mid", "Low"][Math.floor(Math.random() * 3)];

    let newMyHp = myHp;
    let newAiHp = aiHp;
    let newCombo = combo;
    let message;

    if (beats(stance, aiStance)) {
      const dmg = BASE_DAMAGE + newCombo * 3;
      newAiHp = Math.max(0, aiHp - dmg);
      newCombo += 1;
      sfx.correct();
      message = `${stance} beats ${aiStance}! Combo x${newCombo}.`;
    } else if (beats(aiStance, stance)) {
      newMyHp = Math.max(0, myHp - BASE_DAMAGE);
      newCombo = 0;
      sfx.hit();
      message = `${aiStance} counters your ${stance}.`;
    } else {
      newCombo = 0;
      message = `Clash — you both went ${stance}.`;
    }

    setMyHp(newMyHp);
    setAiHp(newAiHp);
    setCombo(newCombo);
    setLog(message);
    setFinishReady(newCombo >= COMBO_TO_FINISH);

    if (newAiHp <= 0 || newMyHp <= 0) {
      const playerWon = newAiHp <= 0;
      const nextMyWins = playerWon ? myWins + 1 : myWins;
      const nextAiWins = playerWon ? aiWins : aiWins + 1;
      setMyWins(nextMyWins);
      setAiWins(nextAiWins);
      sfx[playerWon ? "win" : "wrong"]();
      if (nextMyWins >= ROUNDS_TO_WIN || nextAiWins >= ROUNDS_TO_WIN) {
        setLog(nextMyWins > nextAiWins ? "Victory!" : "Defeated.");
        setGameOver(true);
        finishMatch(nextMyWins, nextAiWins, newMyHp);
      } else {
        setTimeout(() => {
          newRound();
          setLog(playerWon ? "Round won! Next round." : "Round lost. Next round.");
          setBusy(false);
        }, 900);
        return;
      }
    }
    setBusy(false);
  }

  function finisher() {
    if (!finishReady || busy || gameOver) return;
    setBusy(true);
    const newAiHp = Math.max(0, aiHp - FINISHER_DAMAGE);
    setAiHp(newAiHp);
    setCombo(0);
    setFinishReady(false);
    sfx.newBest();
    setLog("FINISHING STRIKE!");
    if (newAiHp <= 0) {
      const nextMyWins = myWins + 1;
      setMyWins(nextMyWins);
      sfx.win();
      if (nextMyWins >= ROUNDS_TO_WIN) {
        setLog("Victory!");
        setGameOver(true);
        finishMatch(nextMyWins, aiWins, myHp);
        return;
      }
      setTimeout(() => {
        newRound();
        setLog("Round won! Next round.");
        setBusy(false);
      }, 900);
      return;
    }
    setBusy(false);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Each exchange, pick High, Mid, or Low. High beats Low, Low beats Mid, Mid beats High — read your opponent
          and counter. Land 4 hits in a row to unlock a Finishing Strike. Best of 3 rounds.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START MATCH
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-3 text-textDim">
        Wins — You: {myWins} · Opponent: {aiWins}
      </p>
      <div className="flex justify-between mb-4 max-w-xs mx-auto">
        <div className="w-[45%]">
          <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full" style={{ width: `${(myHp / MAX_HP) * 100}%`, background: accentColor }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">YOU</p>
        </div>
        <div className="w-[45%]">
          <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full bg-accentMagenta" style={{ width: `${(aiHp / MAX_HP) * 100}%` }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">OPPONENT</p>
        </div>
      </div>

      <p className="font-mono text-[11px] mb-2 h-5" style={{ color: accentColor }}>{log}</p>
      <p className="font-mono text-[10px] mb-4 text-textDim">
        Combo: {combo} {finishReady && <span className="text-accentAmber ap-blink">★ FINISHER READY</span>}
      </p>

      <div className="flex justify-center gap-2 mb-3">
        <button onClick={() => exchange("High")} disabled={busy || gameOver} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-[10px] disabled:opacity-40">
          HIGH
        </button>
        <button onClick={() => exchange("Mid")} disabled={busy || gameOver} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-[10px] disabled:opacity-40">
          MID
        </button>
        <button onClick={() => exchange("Low")} disabled={busy || gameOver} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-[10px] disabled:opacity-40">
          LOW
        </button>
      </div>
      {finishReady && (
        <button onClick={finisher} disabled={busy} className="px-6 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ffb703" }}>
          ⚡ FINISHING STRIKE
        </button>
      )}
    </div>
  );
}
