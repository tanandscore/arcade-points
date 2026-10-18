// Midnight Burn — the list of plant kinds (shared by the world generator and the plant builder; no graphics code in here)
export const K = {
  COCONUT: 0, DOME: 1, PINE: 2, UMBRELLA: 3, GULMOHAR: 4, CYPRESS: 5, ROYAL: 6, TEAK: 7, BANYAN: 8, ARECA: 9, PEEPAL: 11,
  BUSH: 20, BOUGAIN: 21, ORANGE: 22, WHITE: 23, FERN: 24, BANANA: 25, GRASS: 30, TALL: 31, ROCK: 40, BOULDER: 41,
};
// trunk collider size (radius, height) for every tree kind
export const TRUNK = { 0: [0.24, 9], 1: [0.4, 5], 2: [0.42, 18], 3: [0.55, 7], 4: [0.4, 6], 5: [0.3, 12], 6: [0.34, 12], 7: [0.4, 12], 8: [1.0, 8], 9: [0.14, 11], 11: [0.45, 6] };
export const isTree = (k) => k < 20;
