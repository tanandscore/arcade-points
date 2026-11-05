// Blast Grid: 4 worlds, 20 levels. Every level was solved by the automatic solver (solver.js), which also set the "par" for the 3rd star:
// finish with every gem collected and no more than `par` bombs. "sol" is one winning answer (U D L R = step, B = bomb, W = wait); the tests replay it.
// Map letters are explained at the top of rules.js.

export const WORLDS = [
  {
    name: "Sunny Yard", short: "Yard", theme: "meadow", music: "sunny", blurb: "Learn the ropes: bombs, crates and wobbly patrol bots.",
    levels: [
      { id: "1-1", name: "First Boom", bombs: 7, range: 2, max: 1, par: 2, parTurns: 20, hint: "Arrow keys or WASD move you. Space drops a bomb. Blast crates, grab the gems, then reach the door.",
        map: ["#########","#@...*.c#","#.#c#.#.#","#......c#","#c#.#.#c#","#.c*.ccE#","#########"],
        sol: "RRRRDDDBULLDDRBRUDRR" },
      { id: "1-2", name: "Hidden Sparkle", bombs: 7, range: 2, max: 1, par: 3, parTurns: 35, hint: "A bomb goes off 3 turns after you drop it. Step out of its cross in time! Gems hide inside some crates.",
        map: ["#########","#@..CccC#","#.#c#c#*#","#..c....#","#.#c#c#c#","#...c.cE#","#########"],
        sol: "RBLDDRBLUURRRLLLDDRRRRRRUBDLRUUDDDD" },
      { id: "1-3", name: "Wobbly Pal", bombs: 7, range: 2, max: 1, par: 3, parTurns: 34, hint: "Red bots walk straight and turn right at walls. Blast every bot and the door opens. Undo (U) is always free.",
        map: ["#########","#@..*.c.#","#.#c#c#.#","#..Ccc.c#","#.#.#*#c#","#cc^..cE#","#########"],
        sol: "RRRLLLDDRBLDURWBLDURRDDRRUDLBRUDRR" },
      { id: "1-4", name: "Double Patrol", bombs: 8, range: 2, max: 2, par: 5, parTurns: 43, hint: "Bombs set off other bombs. Use chains to clear a lot at once.",
        map: ["###########","#@...c.*.c#","#.#.#.#.#>#","#.cc*.....#","#c#c#C#c#c#","#ccc..>.cE#","###########"],
        sol: "RRDWBURLDDRRLBRUBDRRUUDDLLWDWWBDLRRBLUDRRRR" },
      { id: "1-5", name: "Yard Boss", bombs: 11, range: 2, max: 2, par: 7, parTurns: 61, hint: "Grey sleepers never move, but they still hurt. Blast them from a distance.",
        map: ["###########","#@...c.vc.#","#.#.#.#c#C#","#.c....ccc#","#.#.#c#c#.#","#*.^c..c.Z#","#c#c#.#.#C#","#c.c.c.*cE#","###########"],
        sol: "RBLDURRRBLDDDDLLRBRUDRRRBLDURRDDUURBLDURRUBDLRDUUBDLRUUUDDDDD" },
    ],
  },
  {
    name: "Crystal Mines", short: "Mines", theme: "cave", music: "cave", blurb: "Ghostly hunters chase you through the glowing dark.",
    levels: [
      { id: "2-1", name: "Whisper", bombs: 7, range: 3, max: 1, par: 3, parTurns: 27, hint: "Purple hunters follow you, but only every second turn. Lead one into a blast!",
        map: ["#########","#@..*c.c#","#.#.#.#c#","#.*C....#","#.#c#.#c#","#cc.H.cE#","#########"],
        sol: "DDRBLDURRUURLDBDLRDDRBRUDRR" },
      { id: "2-2", name: "Cold Chase", bombs: 7, range: 3, max: 1, par: 4, parTurns: 31,
        map: ["#########","#@..*c.c#","#.#.#c#c#","#.*..>C.#","#.#.#.#c#","#c..H.cE#","#########"],
        sol: "DDRWBRUUDBURLDDRBRDURLDDLBRUDRR" },
      { id: "2-3", name: "Twin Ghosts", bombs: 7, range: 3, max: 2, par: 4, parTurns: 38,
        map: ["###########","#@..cccc.C#","#.#c#c#c#.#","#....*cHH.#","#c#*#c#.#c#","#c.c.c..cE#","###########"],
        sol: "DDRRRRLBLDULBRDURBLDURRRRRRUBDLRUUDDDD" },
      { id: "2-4", name: "Buried Door", bombs: 12, range: 3, max: 2, par: 8, parTurns: 63, hint: "Some doors are buried inside a crate. Blast the right one to find it.",
        map: ["###########","#@..c..c.c#","#.#.#.#C#.#","#..c.c....#","#.#c#.#.#*#","#ccc.c*...#","#c#c#c#Z#.#","#c<HcccC.X#","###########"],
        sol: "RBRDURRDBURLDDRRRRDDLLLRUBURLUDDDDDRBLUDRBLUDLBRUDRBRUDWUBULRDD" },
      { id: "2-5", name: "Deep Dark", bombs: 10, range: 3, max: 2, par: 7, parTurns: 59,
        map: ["###########","#@..Cc...c#","#.#.#c#c#.#","#....<c.cc#","#c#c#c#H#c#","#c..cccZcc#","#.#c#*#c#H#","#ccc*c..CX#","###########"],
        sol: "RRLBRDDRBLUURLDDRBLUDRRRRDBULRDDDDLBRUDRLLLLRUDRBRUDRBLUDRR" },
    ],
  },
  {
    name: "Neon Docks", short: "Docks", theme: "harbor", music: "city", blurb: "Wide open arenas where one blast can set off the next.",
    levels: [
      { id: "3-1", name: "Open Water", bombs: 7, range: 3, max: 2, par: 3, parTurns: 31, hint: "Blasts stop at walls, and at the first crate they hit.",
        map: ["#########","#@...c.c#","#..c.Cvc#","#.cc*c..#","#...#.cc#","#.*...cE#","#########"],
        sol: "RRRDDUBULRDRLBLUDLLDDRDRRBRUDRR" },
      { id: "3-2", name: "Crane Alley", bombs: 8, range: 3, max: 2, par: 4, parTurns: 33,
        map: ["###########","#@....c.c.#","#..c#c.vc.#","#.....c*^.#","#c#c.C#.cc#","#cc.ccH*cE#","###########"],
        sol: "RDDRRRBLDRURWRRBRUDLDLDWUBRUDWBRD" },
      { id: "3-3", name: "Chain Reaction", bombs: 8, range: 3, max: 2, par: 6, parTurns: 44,
        map: ["###########","#@...c.Zcc#","#.#..c#.#c#","#..c.<cc..#","#....*#Cc.#","#cccc^c*c.#","#ccH#Cc.cc#","#.c..c..cE#","###########"],
        sol: "DDRDRRRBULRDDDUBULRDRRLBRDBURLUDDBRULUBDRRDD" },
      { id: "3-4", name: "Harbor Ring", bombs: 9, range: 3, max: 2, par: 6, parTurns: 46,
        map: ["###########","#@..C*...c#","#...#c.c#.#","#.*Ccc.c.c#","#c.c#.#v#.#","#c.vccccc.#","#..H#Hcc#.#","#........X#","###########"],
        sol: "DDWWRBULRRDUULBRDURRBRDDBULDBRUDLDDDDRBLURDRRR" },
      { id: "3-5", name: "Neon Night", bombs: 9, range: 3, max: 2, par: 7, parTurns: 51,
        map: ["###########","#@...c..c.#","#.....c^#^#","#.Cc...C..#","#c#.cc.Z.c#","#cccc.H*C*#","#cc.#c#c#c#","#ccccH...X#","###########"],
        sol: "RDWWRBLUBDRDLRRRRDDRBLURURDDRBLULBRDLLUBRDDDLBRUDRR" },
    ],
  },
  {
    name: "Ember Core", short: "Core", theme: "volcano", music: "fire", blurb: "Hidden doors, crowded bots and tight bomb supplies.",
    levels: [
      { id: "4-1", name: "Warm Up", bombs: 12, range: 3, max: 2, par: 8, parTurns: 64,
        map: ["###########","#@....c.c.#","#.#.#.#c#v#","#.cccCHccc#","#.#C#.#c#c#","#.*c*..>cX#","###########"],
        sol: "RRRRDWBULRDBULBRDDDDLRRBLUWUUURBLDULLDBULRDBURLDDDDLRRRRBLUDRRRR" },
      { id: "4-2", name: "Lava Lane", bombs: 11, range: 3, max: 2, par: 8, parTurns: 64,
        map: ["###########","#@...Cc..^#","#.#c#c#.#.#","#...c.Cccc#","#c#.#.#.#c#","#cc.c....>#","#c#.#H#.#c#","#c*.c.*.HX#","###########"],
        sol: "DDRRDDDDLBRUDRBLUDRRRBRUBDLLLLUUUBULBRUULBRDURRLLDDRBRDURRDDDDRR" },
      { id: "4-3", name: "Magma Maze", bombs: 12, range: 3, max: 2, par: 10, parTurns: 66,
        map: ["###########","#@..cc.c.c#","#..c#.HC#.#","#.cc.c.ccc#","#cc.#c#.#.#","#*cCcvcc*.#","#.<c#.cv#H#","#...C..c.X#","###########"],
        sol: "DDBURDLDDBDRDRBLURDRLBULRUDDRBRUBDLRRRBULRURLBDLRBURLUBULRUDDDRRDD" },
      { id: "4-4", name: "Sleeping Giants", bombs: 12, range: 3, max: 2, par: 9, parTurns: 71,
        map: ["###########","#@....CCcc#","#.#c#.#c#.#","#.c..Zc.cH#","#*#c#c#^#c#","#cccC.*ccc#","#.#.#c#c#c#","#cccc*.Z^X#","###########"],
        sol: "DDDUUURRRRDBULBRDURLDDDDRBLUBDLRDDRBLUUUULBRUDRBRDUDBULRUBDRLUUDDDDDDRR" },
      { id: "4-5", name: "Ember Finale", bombs: 12, range: 3, max: 2, par: 10, parTurns: 71,
        map: ["###########","#@...cccHH#","#.#ccc#...#","#..c.HcCcZ#","#c*c#c.Zc<#","#*.c*.cccc#","#CcC#>#c.<#","#cc.cccc.X#","###########"],
        sol: "DDRDDLBRUDLDWWURRRLLUUBDLUBRDDRBLDRURRRUBDLUUBRDURDBLDRBURDLWBRDRBULRDD" },
    ],
  },
];

export const FLAT = [];
WORLDS.forEach((w, wi) => w.levels.forEach((lv, li) => { lv.wi = wi; lv.li = li; FLAT.push(lv); }));

// short text for the level picker
export function describeLevel(lv) {
  const m = lv.map.join(""), bots = (m.match(/[<>^vHZ]/g) || []).length, gems = (m.match(/[*C]/g) || []).length;
  const bits = [];
  if (bots) bits.push(`${bots} bot${bots > 1 ? "s" : ""}`);
  if (gems) bits.push(`${gems} gem${gems > 1 ? "s" : ""}`);
  bits.push(`${lv.bombs} bombs`);
  return bits.join(" · ");
}
