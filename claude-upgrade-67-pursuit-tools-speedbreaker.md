# Upgrade 67 — pursuit tools and Speedbreaker (Midnight Burn)
Spike strips (>=2 stars, 200-260 m ahead, 7 s tyre damage: grip x0.55, vmax x0.72), roadblocks (>=3 stars, two parked patrol cars across the road with a gap, max 2), helicopter (>=4 stars, speed 62 m/s, blocks escape unless in a tunnel or >170 m), Speedbreaker (Q, meter 0..1, needs 0.5, lasts 2+6*meter s, world time x0.42, player yaw x1.5 grip x1.25; fills from near misses +0.14, drift, roadblock cleared +0.2, hot pursuit slow charge).
Design note: this is an original build from the public design pattern of police chases in street-racing games, not a copy of any game's code or assets.
Tested headless: all four spawn and work, existing chase/escape/busted still pass, bundles compile, render checked by screenshot. Not tested by hand: balance of roadblock reaction time at top speed.
Files: engine/open/{sim,render}.js, engine/engineAudio.js, MidnightBurnCity.js.
