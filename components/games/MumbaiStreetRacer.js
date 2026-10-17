"use client";

import MidnightBurnCity from "./MidnightBurnCity";

// Mumbai Street Racer — the free-edition racer. It is the present-day Mumbai map from Midnight Burn with a deliberately lighter
// package: standard graphics (no shadows, crowds, festivals or extra anti-aliasing), 12 races, 8 sights, 40 stashes, one starter car,
// no garage shops, no radio and no cinematic intro. The full game is Midnight Burn: Mumbai 2046.
export default function MumbaiStreetRacer(props) {
  return <MidnightBurnCity {...props} tier="free" />;
}
