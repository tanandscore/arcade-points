// Operation Blacksite multiplayer — one room. A Cloudflare Durable Object: every room code gets exactly one of these, wherever in the world
// the players are, and every player's browser keeps one WebSocket open to it.
//
// In the LOBBY it keeps the list of who is in the room and on which team (5 slots a side), and the room leader's choice of map and bot skill.
// During a MATCH it runs the game itself: the same game engine as the browsers (blacksite/engine/engine.js, built for the server into
// ./sim.gen.js — no pictures, sound or controls), 60 steps a second. Nobody's computer is in charge, so nobody's computer can cheat the rules:
//   - players' computers send only what they do (moves, aim, shots, buys...). The engine checks every move (speed, walls, height), every shot
//     (fire rate, ammo, reloads, where it came from) and works out the recoil and spread itself;
//   - each player gets a report of his own that leaves out enemies he couldn't see or hear (so a wall-hack shows nothing), enemy money and
//     ammo, and the other team's radio;
//   - this room refuses floods of messages and oversized messages, and a fake "report" from a browser goes nowhere.
//
// Messages are JSON. Player -> server game traffic: {"k":"i",...} (moves, 20 a second) and {"k":"c",...} (actions). Server -> player: {"k":"s",...}.
// Lobby: team {squad} | cfg {map, diff} | start | ready | end | ping   ->   welcome | lobby {...} | start {...} | left {...} | ended | err {msg}
import { verifyTicket } from "../../lib/mpTicket.js";
import { createEngine } from "./sim.gen.js";

// Multiplayer is switched on/off by an admin (site setting). The website puts "open" in the ticket; when it is off only admins get in.
const MAPS = ["bazaar", "harbor", "quarter", "foundry"], DIFFS = ["recruit", "veteran", "elite"];
const BOTS_A = ["Reyes", "Kade", "Voss", "Milo", "Osei"], BOTS_B = ["Hex", "Rook", "Zane", "Dmitri", "Cobra"];
const SIDE = 5;
const MAX_MSGS_PER_SEC = 90, KICK_MSGS_PER_SEC = 250, MAX_MSG = 4096; // a real player sends about 20-45 a second
const TICK_MS = 25, READY_WAIT_MS = 15000, AUTO_LOBBY_MS = 90000;

export class BlacksiteRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.meta = null; this.sim = null; this.rate = new WeakMap(); }

  async loadMeta() { if (!this.meta) this.meta = (await this.ctx.storage.get("meta")) || null; return this.meta; }
  async saveMeta() { if (this.meta) await this.ctx.storage.put("meta", this.meta); else await this.ctx.storage.delete("meta"); }
  sockets() { return this.ctx.getWebSockets(); }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch { return {}; } }
  members() { return this.sockets().map((ws) => this.att(ws)).filter((a) => a.uid); }
  socketOfSlot(slot) { return this.sockets().find((ws) => { const a = this.att(ws); return a.uid && a.slot === slot; }) || null; }
  send(ws, o) { try { ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch {} }
  broadcast(o, except = null) { const s = typeof o === "string" ? o : JSON.stringify(o); for (const ws of this.sockets()) if (ws !== except && this.att(ws).uid) this.send(ws, s); }
  freeSlot(squad, taken) { const base = squad === "A" ? 0 : SIDE; for (let i = 0; i < SIDE; i++) if (!taken.has(base + i)) return base + i; return -1; }
  lobbyState() {
    const m = this.meta; return { k: "lobby", code: m.code, phase: m.phase, host: m.hostUid, cfg: m.cfg, adminOnly: !!(m.adminOnly),
      members: this.members().map((a) => ({ uid: a.uid, name: a.name, squad: a.squad, slot: a.slot, host: a.uid === m.hostUid, ready: !!a.ready })).sort((a, b) => a.slot - b.slot) };
  }
  // the server was restarted while a match was on (it lives in memory only): back to the lobby
  async recover() {
    if (this.meta && this.meta.phase === "playing" && !this.sim) { this.meta.phase = "lobby"; await this.saveMeta(); this.broadcast({ k: "ended" }); this.broadcast(this.lobbyState()); }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const url = new URL(request.url); const code = (url.pathname.split("/")[3] || "").toUpperCase(); const create = url.searchParams.get("create") === "1";
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    const refuse = (msg) => { this.ctx.acceptWebSocket(server); server.serializeAttachment({}); this.send(server, { k: "err", msg }); try { server.close(4000, msg.slice(0, 100)); } catch {} return new Response(null, { status: 101, webSocket: client }); };

    const claims = await verifyTicket(url.searchParams.get("t"), this.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!claims) return refuse("Your sign-in ticket has expired. Please try again.");
    if (!claims.admin && !claims.open) return refuse("Multiplayer is coming soon.");

    await this.loadMeta(); await this.recover();
    const live = this.members();
    if (this.meta && live.length === 0) { this.stopSim(); this.meta = null; await this.saveMeta(); } // an old, empty room
    if (!this.meta) {
      if (!create) return refuse("No room with that code.");
      this.meta = { code, phase: "lobby", hostUid: claims.uid, cfg: { map: MAPS.includes(url.searchParams.get("map")) ? url.searchParams.get("map") : "bazaar", diff: "veteran" } }; await this.saveMeta();
    } else {
      if (create) return refuse("That room code is already in use.");
      if (this.meta.phase === "playing") return refuse("A match is already being played in this room.");
    }
    // the same person joining again (a second tab, a reload) replaces his old connection
    for (const ws of this.sockets()) { const a = this.att(ws); if (a.uid === claims.uid) { try { ws.serializeAttachment({}); ws.close(4001, "Joined again elsewhere"); } catch {} } }
    const others = this.members().filter((a) => a.uid !== claims.uid);
    if (others.length >= SIDE * 2) return refuse("The room is full.");
    const taken = new Set(others.map((a) => a.slot)); const nA = others.filter((a) => a.squad === "A").length, nB = others.filter((a) => a.squad === "B").length;
    const squad = nA <= nB ? "A" : "B"; const slot = this.freeSlot(squad, taken);
    if (!others.length) this.meta.hostUid = claims.uid; // the first one in leads the room
    await this.saveMeta();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ uid: claims.uid, name: String(claims.name || "Player").replace(/[<>]/g, "").slice(0, 18), squad, slot, ready: false });
    this.send(server, { k: "welcome", uid: claims.uid, code });
    this.broadcast(this.lobbyState());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== "string") return;
    const a = this.att(ws); if (!a.uid) return;
    // flood protection: too many messages are dropped, far too many and the player is disconnected
    const now = Date.now(); let r = this.rate.get(ws); if (!r || now - r.t >= 1000) { r = { t: now, n: 0 }; this.rate.set(ws, r); }
    if (++r.n > MAX_MSGS_PER_SEC) { if (r.n > KICK_MSGS_PER_SEC) { try { ws.close(4003, "Too many messages"); } catch {} } return; }
    if (msg.length > MAX_MSG) return;
    // game traffic goes straight into the match (the engine checks every field)
    if (msg.startsWith('{"k":"i"') || msg.startsWith('{"k":"c"')) { if (this.sim && this.meta && this.meta.phase === "playing") { try { this.sim.netReceive(a.slot, msg); } catch {} } return; }
    let m; try { m = JSON.parse(msg); } catch { return; }
    if (!m || typeof m !== "object") return;
    await this.loadMeta(); if (!this.meta) return; await this.recover();
    const leader = a.uid === this.meta.hostUid;
    switch (m.k) {
      case "team": {
        if (this.meta.phase !== "lobby" || (m.squad !== "A" && m.squad !== "B") || m.squad === a.squad) return;
        const taken = new Set(this.members().filter((x) => x.uid !== a.uid).map((x) => x.slot)); const slot = this.freeSlot(m.squad, taken); if (slot < 0) { this.send(ws, { k: "err", msg: "That team is full." }); return; }
        ws.serializeAttachment({ ...a, squad: m.squad, slot }); this.broadcast(this.lobbyState()); return;
      }
      case "cfg": {
        if (!leader || this.meta.phase !== "lobby") return;
        if (MAPS.includes(m.map)) this.meta.cfg.map = m.map; if (DIFFS.includes(m.diff)) this.meta.cfg.diff = m.diff; await this.saveMeta(); this.broadcast(this.lobbyState()); return;
      }
      case "start": {
        if (!leader || this.meta.phase !== "lobby") return;
        const mem = this.members(); const bySlot = new Map(mem.map((x) => [x.slot, x])); const roster = []; const seeds = {};
        for (let id = 0; id < SIDE * 2; id++) {
          const h = bySlot.get(id); const sq = id < SIDE ? "you" : "them";
          if (h) { seeds[id] = crypto.getRandomValues(new Uint32Array(1))[0] || 1; roster.push({ id, name: h.name, squad: sq, human: h.uid }); }
          else roster.push({ id, name: (id < SIDE ? BOTS_A : BOTS_B)[id % SIDE], squad: sq, human: null });
        }
        if (!this.startSim(roster, seeds, this.meta.cfg)) { this.send(ws, { k: "err", msg: "The game server couldn't start the match. Please try again." }); return; }
        this.meta.phase = "playing"; await this.saveMeta();
        // every player gets the same line-up, plus his own secret dice seed (see engine.js seededRng)
        for (const s of this.sockets()) { const x = this.att(s); if (!x.uid) continue; s.serializeAttachment({ ...x, ready: false }); this.send(s, { k: "start", roster, cfg: this.meta.cfg, host: this.meta.hostUid, you: x.slot, seed: seeds[x.slot] }); }
        return;
      }
      case "ready": { if (this.waiting) this.waiting.delete(a.slot); ws.serializeAttachment({ ...a, ready: true }); return; }
      case "end": { if (!leader || this.meta.phase !== "playing") return; await this.backToLobby(); return; }
      case "ping": this.send(ws, { k: "pong", t: m.t }); return;
      default: return;
    }
  }

  // ---- the match --------------------------------------------------------------------------------------------------------------------------
  startSim(roster, seeds, cfg) {
    this.stopSim();
    let sim;
    try {
      sim = createEngine({
        mount: null, difficulty: cfg.diff, mapId: cfg.map, quality: "low",
        net: { role: "server", myId: -1, roster: roster.map((r) => ({ ...r, seed: seeds[r.id] })), sendTo: (id, s) => { const ws = this.socketOfSlot(id); if (ws) this.send(ws, s); } },
        onMatchEnd: () => { this.overAt = Date.now(); },
      });
    } catch (err) { console.error("blacksite room: could not start", err && err.message); return false; }
    if (!sim) return false;
    this.sim = sim; this.begun = false; this.overAt = 0; this.errors = 0; this.last = Date.now();
    this.waiting = new Set(roster.filter((r) => r.human).map((r) => r.id)); this.readyBy = Date.now() + READY_WAIT_MS;
    this.loop = setInterval(() => this.tick(), TICK_MS);
    return true;
  }
  tick() {
    const sim = this.sim; if (!sim) return; const now = Date.now(); const dt = (now - this.last) / 1000; this.last = now;
    if (!this.begun) { if (this.waiting.size && now < this.readyBy) return; this.begun = true; try { sim.start(); } catch (err) { console.error("blacksite room: start failed", err && err.message); this.abort(); } return; } // waits for everyone's game to load (15 s at most)
    try { sim.tick(dt); this.errors = 0; } catch (err) { if (++this.errors === 1) console.error("blacksite room: tick failed", err && err.message); if (this.errors > 40) this.abort(); }
    if (this.overAt && now - this.overAt > AUTO_LOBBY_MS) this.backToLobby(); // nobody pressed "back to lobby"
  }
  stopSim() { if (this.loop) clearInterval(this.loop); this.loop = null; if (this.sim) { try { this.sim.dispose(); } catch {} } this.sim = null; this.waiting = null; }
  async backToLobby() {
    this.stopSim(); await this.loadMeta(); if (!this.meta) return; this.meta.phase = "lobby"; await this.saveMeta();
    for (const s of this.sockets()) { const x = this.att(s); if (x.uid) s.serializeAttachment({ ...x, ready: false }); }
    this.broadcast({ k: "ended" }); this.broadcast(this.lobbyState());
  }
  abort() { this.broadcast({ k: "err", msg: "The match hit a problem on the game server and was stopped." }); this.backToLobby(); }

  async webSocketClose(ws) { await this.gone(ws); try { ws.close(1000, "bye"); } catch {} }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    const a = this.att(ws); if (!a.uid) return; try { ws.serializeAttachment({}); } catch {}
    await this.loadMeta(); if (!this.meta) return;
    const left = this.members().filter((x) => x.uid !== a.uid);
    if (!left.length) { this.stopSim(); this.meta = null; await this.saveMeta(); return; } // the last one out closes the room
    if (a.uid === this.meta.hostUid) { this.meta.hostUid = left.sort((p, q) => p.slot - q.slot)[0].uid; await this.saveMeta(); } // someone else leads now
    if (this.sim) { try { this.sim.netLeave(a.slot); } catch {} if (this.waiting) this.waiting.delete(a.slot); } // a bot takes over his soldier
    this.broadcast({ k: "left", uid: a.uid, slot: a.slot, name: a.name }, ws);
    this.broadcast(this.lobbyState(), ws);
  }
}
