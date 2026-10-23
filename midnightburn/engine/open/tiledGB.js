// Midnight Burn — a geometry builder that sorts what it is given into square tiles (Upgrade 34).
// The old landmark mesh is ONE mesh for the whole 22 km map, so the graphics card draws every vertex in it on every frame, even when it is kilometres behind the camera.
// The new decorations (cherry-blossom avenues, torii tunnels, marigold arches, banyan trees) are many small shapes spread along roads, so each one goes into the tile it
// stands in; every tile becomes its own mesh, and the engine's normal "is this on screen?" test skips the tiles you cannot see.
import * as THREE from "three";
import { GB } from "./chunks3d";

export class TiledGB {
  constructor(size = 512) { this.size = size; this.cells = new Map(); }
  cell(x, z) {
    const i = Math.floor(x / this.size), j = Math.floor(z / this.size), k = i * 4096 + j; let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = new GB())); return c;
  }
  box(cx, y0, cz, ...a) { this.cell(cx, cz).box(cx, y0, cz, ...a); }
  geo(geom, x, y, z, ...a) { this.cell(x, z).geo(geom, x, y, z, ...a); }
  // one mesh per non-empty tile, all sharing `mat`; returns the list (the caller adds them to its group)
  meshes(mat) {
    const out = []; for (const c of this.cells.values()) { if (c.empty) { c.giveBack(); continue; } out.push(new THREE.Mesh(c.build(), mat)); }
    this.cells.clear(); return out;
  }
}
