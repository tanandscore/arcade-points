// Extra leaderboards that live inside one game.
//
// Midnight Burn has two cities, Mumbai Drift and Tokyo Drift, and each is its own career (Upgrade 37), so each needs its own board. The `scores` table
// stores one best score per player per `game` name, and that name is plain text with no link to the games list, so a second board is just a second name:
// `midnightburn-tokyo`. No database change is needed. The ordinary name (`midnightburn`) stays the Mumbai board, so every score saved before this
// stays where it was.
//
// Everything that is about the GAME itself (access, "continue playing", most played, achievements, activity) keeps using the real slug `midnightburn`;
// only the saved best score and the rankings use the board name.
export const EXTRA_BOARDS = [
  { id: "tokyo", base: "midnightburn", key: "midnightburn-tokyo", name: "Tokyo Drift", baseName: "Mumbai Drift" },
];

// the name a score is saved under: the board's own name for a known extra board, otherwise the game's slug
export function boardKey(game, board) {
  if (board) { const b = EXTRA_BOARDS.find((x) => x.base === game && x.id === board); if (b) return b.key; }
  return game;
}

// back from a saved name to the real game slug (for counting "different games played" and the like)
export function baseSlug(key) {
  const b = EXTRA_BOARDS.find((x) => x.key === key);
  return b ? b.base : key;
}

// the extra boards of a game (empty for almost every game)
export const extraBoardsOf = (game) => EXTRA_BOARDS.filter((x) => x.base === game);
export const extraBoardByKey = (key) => EXTRA_BOARDS.find((x) => x.key === key) || null;
