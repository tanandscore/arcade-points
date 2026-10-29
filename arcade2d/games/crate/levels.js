// Crate Courier: 4 worlds, 20 levels. Every level was found by the level maker and solved by the automatic solver (rules.js), which also gives `par`:
// the fewest moves possible. "sol" is that shortest answer (U R D L); the tests replay it. Map letters are explained at the top of rules.js.

export const WORLDS = [
  {
    name: "Warehouse Row", short: "Row", theme: "factory", music: "puzzle", blurb: "Plain floors, heavy crates. Learn to push without cornering yourself.",
    levels: [
      { id: "1-1", name: "First Shift", par: 6, hint: "Walk into a crate to push it. Push every crate onto a glowing pad.", 
        map: ["#######","# @.$ #","#     #","#  ## #","#  ## #","#######"],
        sol: "RDRRUL" },
      { id: "1-2", name: "Two Pads", par: 12, hint: "You can only push, never pull. Think before you shove a crate against a wall.", 
        map: ["########","#      #","#   ## #","# $*#  #","#  .  @#","########"],
        sol: "UUULLLDLDLDR" },
      { id: "1-3", name: "Tight Aisle", par: 15, 
        map: ["#######","#     #","#$   @#","#. #  #","#  ## #","# . $ #","#######"],
        sol: "ULLLLDRRRRDDDLL" },
      { id: "1-4", name: "Loading Bay", par: 26, 
        map: ["#######","#     #","# ##$ #","#@* . #","# $####","#   . #","#######"],
        sol: "RDLDRRLUULUURRRRDDLLRRUULD" },
      { id: "1-5", name: "Rush Order", par: 24, 
        map: ["#######","# $  .#","#  ##.#","# # $ #","# $   #","# . @ #","#######"],
        sol: "LLLURRURDRUDDLLULLUUURRR" },
    ],
  },
  {
    name: "Frozen Dock", short: "Dock", theme: "snow", music: "snow", blurb: "Ice! A pushed crate keeps sliding until it hits something.",
    levels: [
      { id: "2-1", name: "Thin Ice", par: 10, hint: "Ice is slippery: a crate pushed onto it slides until something stops it.", 
        map: ["#########","#     ~~#","#    ~~$#","# @ ###~#","#~  #   #","#  ~#  .#","#########"],
        sol: "UURRRRRDDD" },
      { id: "2-2", name: "Slide Home", par: 18, 
        map: ["#########","#       #","# $~   ~#","# # $.  #","#@#.# ~ #","# # #~  #","#########"],
        sol: "UURURRRDDLRUULDLDR" },
      { id: "2-3", name: "Cold Corner", par: 18, 
        map: ["########","#   .@ #","#  ##  #","#  ~#~~#","# $.#$ #","# ~  ~~#","########"],
        sol: "LLLDDLDRDRRRUUURUL" },
      { id: "2-4", name: "Skating Rink", par: 30, 
        map: ["#######","# *  @#","#   ~ #","# ~~  #","#~.#$ #","#~ #  #","#######"],
        sol: "DLLLLURRDRRDDDLUURULLULDRRRULL" },
      { id: "2-5", name: "Deep Freeze", par: 27, 
        map: ["########","#. ~   #","#~~  ###","#*  #~ #","# $ #$@#","# . ~  #","########"],
        sol: "DLLLLUURDDRRRUULDRDLLLUUUUL" },
    ],
  },
  {
    name: "Pit Factory", short: "Pits", theme: "volcano", music: "tense", blurb: "Holes swallow crates. Fill each one, and it turns into floor.",
    levels: [
      { id: "3-1", name: "Mind the Gap", par: 24, hint: "A crate pushed into a hole fills it. Then the hole becomes floor you can cross.", 
        map: ["########","#   @ o#","# ##$#$#","# #  # #","#    #.#","#    # #","########"],
        sol: "DDLDDRUUUDDLLLUUURRRRRDD" },
      { id: "3-2", name: "Fill It In", par: 15, 
        map: ["#######","#. @  #","#$#$  #","#o  # #","#.$ # #","#######"],
        sol: "LLDDRRDLURURULL" },
      { id: "3-3", name: "Bridge Work", par: 18, 
        map: ["########","#.o$   #","# ## $ #","# #    #","#@$ .  #","########"],
        sol: "RRURUULRDDRURULLLL" },
      { id: "3-4", name: "Sink or Slide", par: 50, 
        map: ["#########","#       #","# #     #","# *  ####","#   . $ #","# @###$ #","#    o  #","#########"],
        sol: "ULURDRRUULDRDLULDDLDRRRRRRUULLLLULLDDRUDDRRRRURULL" },
      { id: "3-5", name: "Last Pit", par: 29, 
        map: ["#######","#     #","# ###$#","#  .# #","#@$.# #","# $ # #","#o$  .#","#######"],
        sol: "URRDDDLLURDRULULURLUURRRRDDDD" },
    ],
  },
  {
    name: "Grand Depot", short: "Depot", theme: "harbor", music: "city", blurb: "Everything at once: ice, pits and plenty of crates.",
    levels: [
      { id: "4-1", name: "Mixed Load", par: 12, 
        map: ["#########","#~o$@  ~#","#  ###  #","#  ##.# #","# # #$# #","# $~~ .~#","#########"],
        sol: "LLDDLDDRRRRU" },
      { id: "4-2", name: "Cracked Floor", par: 16, 
        map: ["##########","#      ~ #","#  $~$   #","#~o#  #~.#","# ## ~##$#","#.  o  $@#","##########"],
        sol: "UDLLLUUULLLULDDD" },
      { id: "4-3", name: "Double Trouble", par: 23, 
        map: ["#########","#    ~  #","#~ # ####","#*$#o$ o#","# ~##@$*#","#~ ~  . #","#########"],
        sol: "DRRUULLLUULLDDDLDRRRRUR" },
      { id: "4-4", name: "Night Freight", par: 24, 
        map: ["########","#@~~   #","# #$####","# #o $~#","# #~   #","# ~.# *#","#   # *#","########"],
        sol: "RRDDRDRRULLDLDLLUUUURRDD" },
      { id: "4-5", name: "Courier Master", par: 31, 
        map: ["#########","# ~ ~@ o#","# . ~ $ #","#  ~. $ #","# $######","#~ # ####","#~ **   #","#########"],
        sol: "DDLLLLDDRUUULURRRRRRDDLLRRULLLL" },
    ],
  },
];

export const FLAT = []; WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => FLAT.push({ ...l, wi, li })));
export const describeLevel = (l) => `${l.map.join("").split("").filter((c) => c === "$" || c === "*" || c === "%").length} crates · par ${l.par} moves`;
// stars: 3 = within a quarter of the shortest answer, 2 = within double, 1 = solved
export const starsFor = (moves, par) => (moves <= par + Math.ceil(par * 0.25) ? 3 : moves <= par * 2 ? 2 : 1);
