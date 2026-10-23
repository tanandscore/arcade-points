// Stand-ins for the parts of the game the multiplayer game server never uses (3D world, effects, sound, soldier models, picture
// post-processing, music). buildSim.mjs swaps these in when it builds ./sim.gen.js, so the server copy of the engine stays small and never
// touches a screen. The engine doesn't call any of these when it runs as the server — they only have to exist.
const none = () => null;
export const buildWorld = none, createFx = none, createViewModel = none, createSfx = none, buildSoldier = none, poseSoldier = none;
export const createCinematic = none, createGameMusic = none, gpuTier = () => 0, muzzleStarTex = none;
export class RenderPass {}
