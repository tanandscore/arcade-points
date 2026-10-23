# Upgrade 47 — Legend Pass layer (14 non-flagship Legend games)

Flagships (Midnight Burn, Operation Blacksite, Kingdoms of Ash, Wrath of Olympus) untouched.

- Briefing screen before play: controls, goal, three tips (lib/legendInfo.js), rank, today's mission, challenge level.
- Mastery ranks Recruit → Legend (points per run, daily streak bonus), daily mission (score / 3 runs / beat your best).
- Progress saved in browser and in the account (migration_083_legend_progress.sql, /api/legend-progress).
- Challenge level (Standard / Veteran / Nightmare) really changes enemy health, damage and spawn rate in Bloodmoon Siege,
  Starfall Overrun, Arcane Survivor, Arena Survivor; scores get +35% / +80% for harder levels. Other games show the briefing,
  rank and mission only.
- Result screen shows rank points, rank-ups and mission completion.
- Not done: new levels/enemies/modes inside individual games; Power Pass games.
- Not built here: full `next build` (sandbox lacks node_modules); files syntax-checked and lib logic unit-tested only.
