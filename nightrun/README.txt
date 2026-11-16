NIGHTRUN - an original night street-racing and police-pursuit game (single folder, no server needed beyond static hosting)

INSTALL (to add under the site)
1. Copy this whole folder to  public/games/nightrun/  (index.html, game.js, cars/)
2. Add one menu entry that links to /games/nightrun/index.html  (same way as Dustline).

PLAY
W/Up gas, S/Down brake+reverse, A D steer, Space handbrake, Shift nitro, R reset to road, Esc pause, M mute. Gamepad works.
Street Race: reach the glowing gates in order before the rival. Police Pursuit: shake off the police; do not stop or get boxed in.

CREDITS / HONESTY
- All code (physics, city, police, traffic, rival, camera, effects, sound) is original, written for this project. No code, art, map, name or sound from any commercial game is used.
- The four car models in cars/ are the ones you supplied earlier; check their licences before charging for the game.
- Tested only in a software-rendered headless browser: never hand-played, no real-GPU speed check. Expect tuning.

VERSION 2 - REAL CITY
The world is now your supplied New York city model (city/nyc.glb, 3x3 tiles). Walls, roads and routes for traffic, rivals and police are computed from that model itself.
Folder must keep: index.html, game.js, cars/, city/.  Tested only in software rendering, never hand-played.

VERSION 3
- New car: GT3 Racer (your Porsche 992 GT3 R model), also used as a rival.
- Start positions and respawns now land on the street, not the pavement (city/nyc_road.png).
- About 250 poles/signal posts are now solid (city/nyc_obs.json), found from the same scan of the model.
- Computer drivers look ahead for walls and slow down.
Keep: index.html, game.js, cars/, city/.

VERSION 4 - BIG CITY
- One large map (~2.3 x 1.4 km): about 50 districts built from your New York model (turned and mirrored), two wide rivers with 8 bridges,
  and two dense forests whose winding roads are shortcuts between districts (green gates mark the entrances).
- New cars: Lexus RC F GT3 ("RC GT Sprint") and McLaren F1 GTR Longtail ("Longtail GTR"); both also race as rivals.
- Keep: index.html, game.js, cars/, city/, forest/.
Tested only in software rendering, never hand-played; no real-GPU timing.

VERSION 4.1: fixed the rivers (water was hidden under the ground plane, now visible and animated), muted forest tree colours.
