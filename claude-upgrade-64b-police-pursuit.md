# Upgrade 64b — Midnight Burn police pursuit
Heat 1-5 stars from speeding (>40 m/s), traffic hits, pedestrian hits, ramming. Patrol cars (stinger body, white/blue livery, red/blue roof lights) spawn 85-140 m behind, replan a road route to the player every 1.6 s (0.9 s when close), ram at 2+ stars. Escape = all cars >210 m away (or none) for 10 s -> bounty (120+140*peak)*(1+0.08*level) cash, 30+30*peak XP, +40 nitro. Busted = car within 9 m while speed <14 m/s for 3 s -> fine 100+1% of earnings*(0.5+0.5*peak), capped by cash. Disabled in story mode and events (G.copsOff).
Tested headless: chase, escape with bounty, busted with fine, no page errors; patrol car render verified.
Files: engine/open/{pursuit,sim,render,story}.js, engine/engineAudio.js, MidnightBurnCity.js.
