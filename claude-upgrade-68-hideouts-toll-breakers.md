# Upgrade 68 — hideouts, toll runs, pursuit breakers (Midnight Burn)
Hideout: found garages (career.garages) within 26 m at speed <18 m/s for 2.5 s ends the pursuit (60% bounty, counts for daily "escape"); busted meter suppressed while hiding; HUD hint with name and distance.
Toll run: type "toll", derived from the first 5 sprints (both cities), racers 0; start clock 0.35*(len/34)+10 s, bonus per gate = 0.65*(len/34)/gates (min 3), medal by remaining time fraction (>14% gold, >6% silver); timeout = dnf.
Pursuit breakers: 26 per city, seeded by game seed, beside non-highway ground roads, kinds containers/tower/sign; trigger within 20 m at >20 m/s with a chaser within 90 m and heat>0; patrol cars within 20 m of the impact point for 7 s are disabled (7 s), +40 XP, -35 heat points each; rebuild after 110 s.
Tested headless: toll start/gates/finish/gold, breaker trigger + cop wrecked, hideout ends pursuit with payout; bundles compile; screenshots of standing and fallen breaker. Not tested by hand: how easy it is to trigger a breaker at real driving speeds.
Files: engine/open/{content,sim,render}.js, engine/engineAudio.js, MidnightBurnCity.js.
