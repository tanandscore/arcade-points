export const TERRITORIES = ["A", "B", "C", "D", "E", "F", "G"];
export const ADJACENCY = {
  A: ["B", "C"],
  B: ["A", "C", "D"],
  C: ["A", "B", "D", "E"],
  D: ["B", "C", "E", "F"],
  E: ["C", "D", "F", "G"],
  F: ["D", "E", "G"],
  G: ["E", "F"],
};

const MAX_MOVES = 30;

// Player 1 starts on A immediately. G is left unowned until a second
// player actually joins (attachSecondPlayer) — a waiting duel has no
// opponent yet, so it can't be assigned.
export function initialDuelState(player1Id) {
  const owner = { A: player1Id };
  const troops = { A: 6 };
  for (const t of TERRITORIES) {
    if (!owner[t]) {
      owner[t] = null;
      troops[t] = t === "G" ? 6 : 2 + Math.floor(Math.random() * 3);
    }
  }
  return { owner, troops, moveCount: 0 };
}

export function attachSecondPlayer(state, player2Id) {
  return {
    ...state,
    owner: { ...state.owner, G: player2Id },
    troops: { ...state.troops, G: 6 },
  };
}

// Applies exactly one action for `userId`. Returns { state } on
// success or { error } if the move is illegal — the caller (the move
// API route) is the only thing allowed to call this, after already
// confirming it's genuinely this user's turn.
export function applyMove(state, userId, action) {
  const next = { owner: { ...state.owner }, troops: { ...state.troops }, moveCount: state.moveCount };

  if (action.type === "reinforce") {
    const t = action.tile;
    if (!TERRITORIES.includes(t) || next.owner[t] !== userId) {
      return { error: "Not your territory." };
    }
    next.troops[t] = (next.troops[t] || 0) + 1;
  } else if (action.type === "attack") {
    const { from, to } = action;
    if (!TERRITORIES.includes(from) || !TERRITORIES.includes(to)) {
      return { error: "Invalid territory." };
    }
    if (next.owner[from] !== userId) return { error: "Not your territory." };
    if (!ADJACENCY[from].includes(to)) return { error: "Not adjacent." };
    if (next.owner[to] === userId) return { error: "Already yours." };
    if ((next.troops[from] || 0) <= 1) return { error: "Not enough troops to attack." };

    const winChance = next.troops[from] / (next.troops[from] + (next.troops[to] || 1));
    if (Math.random() < winChance) {
      const moved = Math.ceil(next.troops[from] / 2);
      next.troops[from] = Math.floor(next.troops[from] / 2);
      next.owner[to] = userId;
      next.troops[to] = moved;
    } else {
      next.troops[from] = Math.max(1, next.troops[from] - (1 + Math.floor(Math.random() * 3)));
    }
  } else {
    return { error: "Unknown action." };
  }

  next.moveCount += 1;
  return { state: next };
}

// Returns the winning user id, "draw", or null if the match continues.
export function checkWinner(state, player1Id, player2Id) {
  const p1Tiles = TERRITORIES.filter((t) => state.owner[t] === player1Id).length;
  const p2Tiles = TERRITORIES.filter((t) => state.owner[t] === player2Id).length;
  if (p1Tiles === 0) return player2Id;
  if (p2Tiles === 0) return player1Id;
  if (state.moveCount >= MAX_MOVES) {
    if (p1Tiles === p2Tiles) return "draw";
    return p1Tiles > p2Tiles ? player1Id : player2Id;
  }
  return null;
}
