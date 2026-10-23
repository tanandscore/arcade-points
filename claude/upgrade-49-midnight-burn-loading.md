# Upgrade 49 — Midnight Burn: no more "Page Unresponsive" while the city loads

Cause: the city (roads, buildings, lamps, street furniture) was built in one uninterrupted run. On slower computers that run
lasts several seconds, so Chrome showed "Page Unresponsive". (Measured in the build sandbox: ~58 s in one block.)

Fix: `buildCityGen` (roads.js) and `createCityWorldGen` (world.js) are now generators that pause at section boundaries and
inside the heavy loops; `levelCrossingsGen` is a generator too. `MidnightBurnCity.js` runs them in ~24 ms slices
(`getCityAsync`), so the page stays responsive and the loading bar moves. The old one-shot `buildCity` / `createCityWorld`
still exist and give the same result.

Checked: the new build gives the identical city (same fingerprint: 121884 buildings, 2392 roads, 69838 lamps, 80827 furniture,
hash 359731784) as the original; longest pause between yields dropped from ~58 s to ~2 s in the sandbox.
Not checked in a real browser.
