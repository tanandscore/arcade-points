// Skyline Siege — the rules of the world: the hero, the guns, the Syndicate's troops, and the lines the hero says.
// Numbers here are the "balance sheet" of the game: change one and the whole game gets easier or harder.

export const TS = 48;         // tile size in pixels
export const ROWS = 14;       // every level is 14 tiles tall
export const FLOOR = 11;      // the street surface is the top of row 11 (so row 10 is the row you walk in)

export const HERO = { w: 26, h: 56, hCrouch: 36, hp: 100, maxArmor: 50, inv: 0.9 };
// how the hero runs and jumps (shared with the autopilot so the two always agree)
export const PHYS = { maxRun: 236, accel: 2300, decel: 2700, airAccel: 1500, airDecel: 800, gravity: 2300, fallGravityMul: 1.25, jumpV: 770, jumpCut: 0.48, maxFall: 880, coyote: 0.1, buffer: 0.12 };

export const WEAPONS = {
  pistol: { name: "Peacemaker", short: "PISTOL", rate: 0.24, dmg: 1, speed: 1000, life: 0.9, ammo: Infinity, max: Infinity, color: "#ffe9a8", sfx: "pistol", kick: 30 },
  smg: { name: "Rattler", short: "SMG", rate: 0.07, dmg: 0.55, speed: 1080, life: 0.8, spread: 0.07, ammo: 90, max: 270, color: "#ffd166", sfx: "smg", kick: 14 },
  shotgun: { name: "Thumper", short: "SHOTGUN", rate: 0.62, dmg: 0.85, pellets: 6, spread: 0.36, speed: 920, life: 0.2, ammo: 14, max: 42, color: "#ffb36b", sfx: "shotgun", kick: 150, knock: 120 },
  laser: { name: "Prism", short: "LASER", rate: 0.2, dmg: 1.4, speed: 1500, life: 0.9, pierce: 3, ammo: 44, max: 132, color: "#5ff0ff", sfx: "laser", kick: 24 },
  rocket: { name: "Skybreaker", short: "ROCKET", rate: 0.85, dmg: 3, speed: 560, life: 2.4, ammo: 6, max: 18, color: "#ff7a45", sfx: "rocket", splash: 108, splashDmg: 6, kick: 240 },
};
export const WEAPON_ORDER = ["pistol", "smg", "shotgun", "laser", "rocket"];
export const PICKUP_WEAPON = { "1": "smg", "2": "shotgun", "3": "laser", "4": "rocket" };
export const GRENADE = { splash: 120, dmg: 7, fuse: 1.2, speed: 470, max: 6 };

// foes: hp is counted in Peacemaker hits. pts = score for defeating one.
export const ENEMY = {
  g: { name: "Grunt", w: 30, h: 54, hp: 3, pts: 100, speed: 62 },
  h: { name: "Shield Brute", w: 44, h: 64, hp: 15, pts: 250, speed: 46 },
  s: { name: "Sniper", w: 28, h: 54, hp: 3, pts: 200, speed: 0 },
  d: { name: "Drone", w: 40, h: 28, hp: 3, pts: 150, speed: 130, flyer: true },
  t: { name: "Turret", w: 40, h: 30, hp: 7, pts: 200, speed: 0 },
  b: { name: "Bomber", w: 30, h: 34, hp: 2, pts: 120, speed: 205 },
  j: { name: "Jet Trooper", w: 32, h: 54, hp: 5, pts: 250, speed: 120, flyer: true },
  m: { name: "Walker Mech", w: 100, h: 112, hp: 50, pts: 1500, speed: 34 },
};
export const ENEMY_CHARS = Object.keys(ENEMY).join("");

export const COMBO_WINDOW = 3.0;
export const CASH = 250, CITIZEN = 1000;

// every character that can appear inside a level map (tile letters first, then things that spawn)
export const TILE_CHARS = { solid: "#XBC", oneway: "=", hazard: "^" };
export const ENT_CHARS = "PFKyR$+roae1234" + ENEMY_CHARS + "Z";

// things Rex says (all original). Picked at random per event, never twice in a row.
export const QUIPS = {
  start: ["Port Meridian, huh? Nice place to ruin.", "Let's clear the street.", "Time to take out the trash."],
  weapon: { smg: "The Rattler. Say hello!", shotgun: "Thumper. Knock knock.", laser: "Prism time!", rocket: "Skybreaker online!" },
  checkpoint: ["Halfway decent spot.", "Radio's up. Keep going.", "One more block."],
  streak: ["Next!", "Who's next?", "Too easy.", "Come on, give me a challenge!"],
  hurt: ["Ouch. That counted.", "Okay, rude.", "Not the jacket!"],
  low: ["Need a medkit...", "Running on fumes!"],
  rescue: ["You're safe now!", "Get out of here, quick!", "Run along, citizen!"],
  secret: ["Heh, found a stash.", "Knew there was something behind that wall."],
  boss: ["That's a big one.", "Now it gets interesting.", "Bigger they are..."],
  win: ["Street's clear.", "Another block, another win.", "That's how it's done!"],
  lose: ["Not my best moment."],
};
