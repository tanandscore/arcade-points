"use client";
// Garden Guards — a lane-defence game (free). Plant defenders, collect dew and stop the Gloom Gang before they reach the house.
// 4 worlds, 20 levels. Every level was beaten by the automatic player.
import { createKitGame } from "../shell/Kit";
import { GardenSession, NO_INPUT } from "./garden/session";
import { WORLDS, FLAT, describeLevel } from "./garden/levels";

const def = {
  id: "gardenguards", title: "Garden Guards", titleSize: 60, genreLabel: "Lane defence · Free", accent: "#8ae234", music: "sunny",
  touch: "none",
  tagline: "Plant your defenders along the lanes and stop the Gloom Gang.",
  goal: "The Gloom Gang walks in along five lanes and wants your house. Tap a seed card, then tap a square to plant a defender. Defenders cost dew: collect the drops that fall from the sky, and plant Dewbloom flowers to grow more. Keep every lane covered. If a Grub reaches the house, a garden cart sweeps the lane clean once, so you get one mistake per lane. Win without using a cart for stars.",
  controls: [["Click a seed card, then a square", "Plant a defender (you can also drag the card)"], ["Click falling dew", "Collect it"], ["1 to 6", "Pick a seed card"], ["X or Shovel button", "Dig up a defender"], ["F or x2 button", "Play twice as fast"], ["R", "Restart the level"], ["P or Esc", "Pause"]],
  touchControls: [["Tap a seed card, then a square", "Plant a defender (or drag the card)"], ["Tap falling dew", "Collect it"], ["Shovel", "Dig up a defender"], ["x2", "Play twice as fast"]],
  tips: ["Plant two Dewbloom flowers first. More dew means more defenders.", "Every lane needs at least one shooter before the first Grub arrives.", "Bramble Walls hold big enemies still while your Pods shoot.", "Hoppers jump over the first defender they meet, so put a shooter behind your wall.", "Save the Chili Bomb for a crowd or a Brute.", "At night no dew falls, so Dewbloom is your only income."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new GardenSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the automatic player defends level 1-3 all by itself
    const lv = FLAT.find((l) => l.id === "1-3") || FLAT[0];
    let S = null;
    const make = () => { S = new GardenSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); };
    make();
    return {
      update(dt) { S.update(dt, NO_INPUT, env); },
      draw(g) { g.save(); g.translate(530, 128); g.scale(0.45, 0.45); g.translate(-X_OFF, -Y_OFF); S.draw(g, env); g.restore(); },
    };
  },
};
const X_OFF = 70, Y_OFF = 92;

export default createKitGame(def);
export { def as GARDEN_DEF };
