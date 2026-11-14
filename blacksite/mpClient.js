// Operation Blacksite multiplayer — the browser side of a room: asks the website for a ticket, opens the room's WebSocket, keeps the lobby
// up to date and passes game traffic between the game server (the room) and the engine. See blacksite/server/room.js for the other end.

export async function mpStatus() {
  try { const r = await fetch("/api/mp/ticket", { cache: "no-store" }); return await r.json(); } catch { return { admin: false, comingSoon: true }; }
}

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, so codes can be read out loud
export function randomCode() { let s = ""; const a = new Uint32Array(5); crypto.getRandomValues(a); for (const v of a) s += ALPH[v % ALPH.length]; return s; }
export const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

// h: { onLobby(state), onWelcome({uid, code}), onStart(msg), onGame(null, json), onLeft(msg), onEnded(), onError(text, fatal), onClose(reason) }
export function openRoom({ code, create, ticket, map, base }, h) {
  const origin = base || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;
  const url = `${origin}/mp/blacksite/${cleanCode(code)}?t=${encodeURIComponent(ticket)}${create ? "&create=1" : ""}${map ? "&map=" + encodeURIComponent(map) : ""}`;
  const ws = new WebSocket(url); let closedByUs = false, errored = false, welcomed = false;
  ws.onmessage = (ev) => {
    const d = ev.data; if (typeof d !== "string") return;
    if (d.startsWith('{"k":"s"')) { h.onGame && h.onGame(null, d); return; } // the game server's report
    let m; try { m = JSON.parse(d); } catch { return; }
    switch (m.k) {
      case "lobby": h.onLobby && h.onLobby(m); break;
      case "welcome": welcomed = true; h.onWelcome && h.onWelcome(m); break;
      case "start": h.onStart && h.onStart(m); break;
      case "left": h.onLeft && h.onLeft(m); break;
      case "ended": h.onEnded && h.onEnded(); break;
      case "err": if (!welcomed) errored = true; h.onError && h.onError(m.msg || "Something went wrong.", !welcomed); break; // before "welcome" = refused at the door
      default: break;
    }
  };
  ws.onclose = (ev) => { if (!closedByUs && !errored) h.onClose && h.onClose(ev.reason || "Connection lost."); };
  ws.onerror = () => {};
  const send = (o) => { if (ws.readyState === 1) ws.send(typeof o === "string" ? o : JSON.stringify(o)); };
  return {
    send,
    team: (squad) => send({ k: "team", squad }), cfg: (o) => send({ k: "cfg", ...o }), start: () => send({ k: "start" }), ready: () => send({ k: "ready" }), end: () => send({ k: "end" }),
    close() { closedByUs = true; try { ws.close(1000, "left"); } catch {} },
    get open() { return ws.readyState === 1; },
  };
}
