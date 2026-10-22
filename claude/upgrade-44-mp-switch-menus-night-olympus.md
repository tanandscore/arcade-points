# Upgrade 44 — multiplayer switch, modern menus, night racing, Olympus balance

1. **Blacksite multiplayer switch.** New column `site_settings.blacksite_mp_open` (run `supabase/migration_080_blacksite_mp_switch.sql` once). Admin → Site settings has a Switch ON/OFF button. OFF (default): players see "Coming soon", admins can still test. ON: every signed-in player can create/join rooms. `/api/mp/ticket` reads the setting and puts `open` in the signed ticket; `room.js` refuses non-admins when it is off.
2. **Menus.** Operation Blacksite and Midnight Burn title menus rebuilt as modern two-column panels.
3. **Midnight Burn night.** `tod.js` TOD_CYCLE: night holds ~16 min of a ~21 min day (about 85%).
4. **Wrath of Olympus balance.** Both sides start with 3 hoplites. First raid later and smaller (Recruit 840s/6, Veteran 720s/9, Elite 540s/14); waves grow 35%; AI never launches early; army capped before each wave; 75 s warning alert before the first raid.
