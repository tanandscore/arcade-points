"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { TERRITORIES, ADJACENCY, initialDuelState, attachSecondPlayer, applyMove, checkWinner } from "@/lib/territoryDuel";
import { sfx } from "@/lib/sound";

const INACTIVITY_MS = 60 * 1000;
const AI_ID = "__AI__";

function aiPickMove(state) {
  const attackers = TERRITORIES.filter((t) => state.owner[t] === AI_ID && state.troops[t] > 2);
  for (const t of attackers) {
    const targets = ADJACENCY[t].filter((adj) => state.owner[adj] !== AI_ID && state.troops[adj] < state.troops[t]);
    if (targets.length) {
      const target = targets.sort((a, b) => state.troops[a] - state.troops[b])[0];
      return { type: "attack", from: t, to: target };
    }
  }
  const ownTiles = TERRITORIES.filter((t) => state.owner[t] === AI_ID);
  if (ownTiles.length) {
    const weakest = ownTiles.sort((a, b) => state.troops[a] - state.troops[b])[0];
    return { type: "reinforce", tile: weakest };
  }
  return null;
}

export default function TerritoryDuel({ onFinish, accentColor }) {
  const [phase, setPhase] = useState("idle"); // idle | searching | active | finished
  const [duelId, setDuelId] = useState(null);
  const [duel, setDuel] = useState(null);
  const [myId, setMyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState("");
  const [secondsSinceMove, setSecondsSinceMove] = useState(0);
  const [isVsAI, setIsVsAI] = useState(false);
  const supabaseRef = useRef(null);
  const finishedRef = useRef(false);
  const tickRef = useRef(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id));
  }, [supabase]);

  // Ticks once a second while it's the opponent's turn, so the
  // "claim win" option can appear as soon as they've genuinely gone
  // quiet rather than needing a page refresh to notice. Not relevant
  // in AI mode, since a bot never goes inactive.
  useEffect(() => {
    clearInterval(tickRef.current);
    if (!isVsAI && phase === "active" && duel && duel.turn_user_id !== myId) {
      tickRef.current = setInterval(() => {
        setSecondsSinceMove(Math.floor((Date.now() - new Date(duel.updated_at).getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(tickRef.current);
  }, [phase, duel, myId, isVsAI]);

  useEffect(() => () => clearInterval(tickRef.current), []);

  // Drives the AI's turn automatically — a short pause so it doesn't
  // feel instantaneous/jarring, then applies exactly the same
  // applyMove() logic the server uses for real multiplayer moves.
  useEffect(() => {
    if (!isVsAI || phase !== "active" || !duel || duel.turn_user_id !== AI_ID) return undefined;
    const t = setTimeout(() => {
      const move = aiPickMove(duel.state);
      if (!move) return;
      const result = applyMove(duel.state, AI_ID, move);
      if (result.error) return;
      const winner = checkWinner(result.state, myId, AI_ID);
      const nextDuel = { ...duel, state: result.state, turn_user_id: myId, updated_at: new Date().toISOString() };
      if (winner) {
        nextDuel.status = "finished";
        nextDuel.winner_id = winner === "draw" ? null : winner;
        setDuel(nextDuel);
        handleFinished(nextDuel, myId);
      } else {
        setDuel(nextDuel);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel, isVsAI, phase, myId]);

  function handleFinished(row, myUserId) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setDuel(row);
    setPhase("finished");
    const myTiles = TERRITORIES.filter((t) => row.state.owner[t] === myUserId).length;
    let score;
    if (row.winner_id === myUserId) {
      score = 300 + myTiles * 20;
      sfx.newBest();
    } else if (row.winner_id === null) {
      score = 150;
      sfx.win();
    } else {
      score = myTiles * 15;
      sfx.lose();
    }
    setTimeout(() => onFinish(score), 900);
  }

  async function findMatch() {
    setPhase("searching");
    setIsVsAI(false);
    setLog("");
    const res = await fetch("/api/duels/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_slug: "territoryduel" }),
    });
    const data = await res.json();
    if (!data.duelId) {
      setLog(data.error || "Couldn't find a match.");
      setPhase("idle");
      return;
    }

    setDuelId(data.duelId);
    const { data: userData } = await supabase.auth.getUser();
    const myUserId = userData.user?.id;

    const { data: row } = await supabase.from("duels").select("*").eq("id", data.duelId).single();
    setDuel(row);
    setPhase(row.status === "active" ? "active" : "searching");
    if (row.status === "active") sfx.select();

    supabase
      .channel(`duel-${data.duelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${data.duelId}` },
        (payload) => {
          const updated = payload.new;
          setDuel(updated);
          if (updated.status === "active" && phase !== "active") {
            setPhase("active");
            sfx.select();
          }
          if (updated.status === "finished") {
            handleFinished(updated, myUserId);
          }
        }
      )
      .subscribe();
  }

  function startVsAI() {
    finishedRef.current = false;
    const myUserId = myId;
    const base = initialDuelState(myUserId);
    const state = attachSecondPlayer(base, AI_ID);
    setDuel({
      state,
      turn_user_id: myUserId,
      status: "active",
      winner_id: null,
      updated_at: new Date().toISOString(),
    });
    setIsVsAI(true);
    setPhase("active");
    setLog("");
    sfx.select();
  }

  async function sendAction(action) {
    if (isVsAI) {
      const result = applyMove(duel.state, myId, action);
      if (result.error) {
        setLog(result.error);
        return;
      }
      setLog("");
      const winner = checkWinner(result.state, myId, AI_ID);
      const nextDuel = { ...duel, state: result.state, turn_user_id: AI_ID, updated_at: new Date().toISOString() };
      if (winner) {
        nextDuel.status = "finished";
        nextDuel.winner_id = winner === "draw" ? null : winner;
        setDuel(nextDuel);
        handleFinished(nextDuel, myId);
      } else {
        setDuel(nextDuel);
      }
      return;
    }

    const res = await fetch(`/api/duels/${duelId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const data = await res.json();
    if (!res.ok) {
      setLog(data.error || "Move failed.");
    } else {
      setLog("");
    }
  }

  async function cancelSearch() {
    if (duelId) {
      await fetch(`/api/duels/${duelId}/cancel`, { method: "POST" });
    }
    setPhase("idle");
    setDuelId(null);
    setDuel(null);
    setLog("");
  }

  // Used by "Play vs AI instead" while mid-search — awaits the cancel
  // completing before switching modes, so the cancel's own cleanup
  // (which sets phase back to "idle") can't fire after and stomp on
  // the AI game we just started.
  async function switchToAI() {
    if (duelId) {
      await fetch(`/api/duels/${duelId}/cancel`, { method: "POST" });
    }
    setDuelId(null);
    setDuel(null);
    setLog("");
    startVsAI();
  }

  async function claimWin() {
    const res = await fetch(`/api/duels/${duelId}/claim`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setLog(data.error || "Couldn't claim yet.");
    }
    // On success, the row update arrives via the same Realtime
    // subscription used for normal moves — no need to handle it here.
  }

  function handleTileClick(t) {
    if (!duel || duel.turn_user_id !== myId || phase !== "active") return;
    const owner = duel.state.owner[t];
    if (!selected) {
      if (owner === myId) {
        setSelected(t);
        sfx.select();
      }
      return;
    }
    if (t === selected) {
      setSelected(null);
      return;
    }
    if (!ADJACENCY[selected].includes(t) || owner === myId) {
      setLog("Pick an adjacent enemy or neutral territory.");
      return;
    }
    sendAction({ type: "attack", from: selected, to: t });
    setSelected(null);
  }

  function reinforce() {
    if (!selected || !duel || duel.turn_user_id !== myId) return;
    sendAction({ type: "reinforce", tile: selected });
    setSelected(null);
  }

  if (phase === "idle") {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Find a real opponent, or play an instant match against the computer if no one's around. Take turns
          reinforcing or attacking across 7 territories until one side controls the board.
        </p>
        {log && <p className="text-accentMagenta text-xs mb-4">{log}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={findMatch} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            FIND OPPONENT ▸
          </button>
          <button onClick={startVsAI} className="font-mono text-[10px] px-5 py-3 rounded-md border border-lineColor text-textLight">
            Play vs AI instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber ap-blink mb-3">SEARCHING FOR OPPONENT...</p>
        <p className="text-textDim text-xs mb-5">This fills the moment another player queues up — no need to refresh.</p>
        <div className="flex justify-center gap-3">
          <button onClick={cancelSearch} className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textDim">
            Cancel search
          </button>
          <button
            onClick={switchToAI}
            className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textLight"
          >
            Play vs AI instead
          </button>
        </div>
      </div>
    );
  }

  const isMyTurn = duel?.turn_user_id === myId;
  const canClaim = !isVsAI && phase === "active" && !isMyTurn && secondsSinceMove >= INACTIVITY_MS / 1000;
  const claimCountdown = Math.max(0, Math.ceil(INACTIVITY_MS / 1000 - secondsSinceMove));

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-4" style={{ color: phase === "finished" ? "#ffb703" : isMyTurn ? accentColor : "#a99fd6" }}>
        {phase === "finished"
          ? duel?.winner_id === myId
            ? "You won!"
            : duel?.winner_id === null
            ? "It's a draw."
            : "You lost this one."
          : isMyTurn
          ? "Your turn"
          : isVsAI
          ? "AI is thinking..."
          : "Waiting for opponent's move..."}
      </p>
      {log && <p className="font-mono text-[11px] text-accentMagenta mb-3">{log}</p>}

      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto mb-4">
        {TERRITORIES.map((t) => {
          const owner = duel?.state?.owner?.[t];
          const isMine = owner === myId;
          const color = isMine ? accentColor : owner ? "#ff3ea5" : "#a99fd6";
          return (
            <button
              key={t}
              onClick={() => handleTileClick(t)}
              disabled={!isMyTurn || phase === "finished"}
              className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center font-mono text-[10px] disabled:opacity-70"
              style={{ borderColor: selected === t ? "#ffffff" : color, color, background: "#241154" }}
            >
              <span>{t}</span>
              <span>{duel?.state?.troops?.[t] ?? ""}</span>
            </button>
          );
        })}
      </div>

      {selected && isMyTurn && phase === "active" && (
        <button onClick={reinforce} className="font-mono text-[10px] px-3 py-2 rounded-md border border-lineColor text-textLight">
          +1 troop to {selected}
        </button>
      )}

      {!isVsAI && phase === "active" && !isMyTurn && (
        <div className="mt-2">
          {canClaim ? (
            <button
              onClick={claimWin}
              className="font-mono text-[10px] px-4 py-2 rounded-md border text-accentAmber"
              style={{ borderColor: "#ffb703" }}
            >
              🚩 Claim win — opponent inactive
            </button>
          ) : (
            <p className="font-mono text-[10px] text-textDim">
              Opponent gone quiet? You can claim a win in {claimCountdown}s if they don't move.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
