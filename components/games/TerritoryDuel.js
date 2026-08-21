"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { TERRITORIES, ADJACENCY } from "@/lib/territoryDuel";
import { sfx } from "@/lib/sound";

export default function TerritoryDuel({ onFinish, accentColor }) {
  const [phase, setPhase] = useState("idle"); // idle | searching | active | finished
  const [duelId, setDuelId] = useState(null);
  const [duel, setDuel] = useState(null);
  const [myId, setMyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState("");
  const supabaseRef = useRef(null);
  const finishedRef = useRef(false);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id));
  }, [supabase]);

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

  async function sendAction(action) {
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
          Real 1v1 multiplayer — no AI. Find an opponent, then take turns reinforcing or attacking across 7
          territories until one of you controls the board.
        </p>
        {log && <p className="text-accentMagenta text-xs mb-4">{log}</p>}
        <button onClick={findMatch} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          FIND OPPONENT ▸
        </button>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="text-center">
        <p className="font-pixel text-xs text-accentAmber ap-blink mb-3">SEARCHING FOR OPPONENT...</p>
        <p className="text-textDim text-xs">This fills the moment another player queues up — no need to refresh.</p>
      </div>
    );
  }

  const isMyTurn = duel?.turn_user_id === myId;

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
    </div>
  );
}
