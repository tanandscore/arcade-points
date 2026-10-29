// Skyline Siege — the four district bosses. Each lives in its own file under boss/.
import { Crane } from "./boss/crane";
import { Widow } from "./boss/widow";
import { Titan } from "./boss/titan";
import { Architect } from "./boss/architect";

export function makeBoss(kind, spawn, S) {
  switch (kind) {
    case "crane": return new Crane(S, spawn);
    case "widow": return new Widow(S, spawn);
    case "titan": return new Titan(S, spawn);
    case "architect": return new Architect(S, spawn);
    default: return null;
  }
}
