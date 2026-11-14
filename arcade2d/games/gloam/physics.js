// Gloamreach hero movement as a pure function, so the game and the map checker use exactly the same rules.
import { moveBody, heroControl, HERO_DEFAULT } from "../../core/platformer";
export const P = { ...HERO_DEFAULT, maxRun: 250, jumpV: 705, gravity: 2300 };
export const newHero = (x, y) => ({ x, y, w: 26, h: 44, vx: 0, vy: 0, face: 1, onGround: false, inv: 0, dash: 0, dashCd: 0, dashUsed: false, dj: false, wall: 0, wallDir: 0, wallT: 0, lock: 0, jumping: false, coyoteT: 0, bufferT: 0 });
// inp: { dir, jp (jump pressed this frame), jh (jump held), dashp, down }
export function heroPhysics(H, inp, dt, map, abil) {
  const ev = {}; H.dashCd = Math.max(0, H.dashCd - dt); H.lock = Math.max(0, H.lock - dt); H.wallT = Math.max(0, H.wallT - dt);
  const dir = H.lock > 0 ? 0 : inp.dir;
  if (H.dash > 0) { H.dash -= dt; H.vx = H.face * 620; H.vy = 0; ev.dashing = true; if (H.dash <= 0) H.vx = H.face * 220; }
  else {
    if (inp.dashp && abil.dash && H.dashCd <= 0 && !H.dashUsed) { H.dash = 0.26; H.dashCd = 0.35; H.dashUsed = !H.onGround; H.face = dir || H.face; ev.dash = true; }
    const r = heroControl(H, { dir, jumpPressed: inp.jp && H.wall === 0, jumpHeld: inp.jh }, dt, P, {});
    if (r.jumped) { ev.jump = true; H.dj = false; }
    else if (inp.jp && !H.onGround && H.wall === 0 && H.wallT <= 0 && abil.dj && !H.dj && (H.coyoteT || 0) <= 0) { H.vy = -640; H.dj = true; H.jumping = true; ev.dj = true; }
    if (inp.jp && (H.wall !== 0 || H.wallT > 0) && !H.onGround && abil.wall) { const wd = H.wall || H.wallDir; H.vy = -700; H.vx = -wd * 270; H.face = -wd; H.lock = 0.17; H.wall = 0; H.wallT = 0; H.dj = false; H.dashUsed = false; H.jumping = true; ev.wj = wd; }
  }
  const vy0 = H.vy; moveBody(map, H, dt, { dropThrough: !!inp.down && H.onGround });
  if (H.onGround) { ev.landed = vy0; H.dj = false; H.dashUsed = false; H.wall = 0; }
  H.wall = 0;
  if (!H.onGround && H.dash <= 0 && abil.wall && H.vy > -50) { const toward = (H.hitL && inp.dir < 0) || (H.hitR && inp.dir > 0); if (toward) { H.wall = H.hitL ? -1 : 1; H.wallDir = H.wall; H.wallT = 0.12; H.vy = Math.min(H.vy, 80); H.dj = false; H.dashUsed = false; ev.cling = true; } }
  if (H.wall === 0 && (H.hitL || H.hitR) && H.dash <= 0 && !H.onGround && abil.wall) { H.wallT = Math.max(H.wallT, 0.08); H.wallDir = H.hitL ? -1 : 1; }
  if (dir && H.dash <= 0) H.face = dir;
  return ev;
}
