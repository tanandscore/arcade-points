# Upgrade 48 — New content in six Legend Pass games, Titan Arena keyboard + Fury, Mumbai Street Racer removed

Needs upgrade 47 (lib/legend.js) in place first: the four survivor games import it.

- Bloodmoon Siege, Starfall Overrun: 2 new enemy kinds each, perks Blood Pact / Shockwave / Iron Skin, two timed "surge" events (double enemies, double gems) per run.
- Arcane Survivor: 2 new enemy kinds, passives Blood Pact and Iron Skin, surge events.
- Arena Survivor: 2 new enemy kinds, shop items Vampire Fangs and Scrap Magnet, swarm waves (4, 8) and bounty waves (6, 9).
- Duskward: two new zones (Emberpeak Caldera lvl 9, Frostmere Citadel lvl 12), 4 monsters, 8 late-game items gated by level; quests only ask for monsters in zones already unlocked.
- Emberlight: 7 rooms before the boss (was 4), 2 new enemy kinds, 3 new blessings.
- Titan Arena: keyboard controls, Titan Fury meter and super move, "FINAL BLOW" banner. No Mortal Kombat characters or moves; no photoreal art.
- Mumbai Street Racer: set inactive via migration_084 (reversible).
- lib/survivorExtras.js: shared perks and surge helper. Logic unit-tested in Node; games syntax-checked only.
