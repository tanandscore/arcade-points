// Operation Blacksite — team radio, Counter-Strike style. Three menus (Z commands, X group orders, V responses), a running radio log on the
// HUD, and spoken lines: the browser's own speech voices read each call, every soldier with a voice of his own, after a radio click.
// Only your own team's radio is heard. Computer soldiers call things out by themselves and obey the orders you give (see bots.js).
//
//   const radio = createRadio({ now, sfx, zoneName, getVolume });
//   radio.say(ent, id, { where, extra })   radio.log(playerTeam)   radio.menu   radio.voiceOn / setVoice(on)   radio.dispose()

export const RADIO_MENUS = {
  KeyZ: { key: "Z", title: "RADIO COMMANDS", items: ["coverme", "takepoint", "hold", "regroup", "followme", "takingfire"] },
  KeyX: { key: "X", title: "GROUP RADIO", items: ["go", "fallback", "sticktog", "getinpos", "storm", "reportin"] },
  KeyV: { key: "V", title: "RADIO RESPONSES", items: ["affirm", "spotted", "backup", "clear", "inpos", "reporting", "blow", "negative", "enemydown"] },
};

// text shown in the log and the menus; say = what is spoken (a few ways of saying it, picked at random); loc = add where the speaker is
export const RADIO = {
  coverme: { text: "Cover me!", say: ["Cover me!", "Cover me, cover me!"] },
  takepoint: { text: "You take the point.", say: ["You take the point."] },
  hold: { text: "Hold this position.", say: ["Hold this position.", "Hold here."] },
  regroup: { text: "Regroup, team.", say: ["Regroup, team.", "Regroup on me."] },
  followme: { text: "Follow me.", say: ["Follow me.", "On me, follow me."] },
  takingfire: { text: "Taking fire, need assistance!", say: ["Taking fire, need assistance!", "Taking fire!"], loc: true },
  go: { text: "Go, go, go!", say: ["Go, go, go!", "Go go go!"] },
  fallback: { text: "Fall back!", say: ["Fall back!", "Fall back, fall back!"] },
  sticktog: { text: "Stick together, team.", say: ["Stick together, team."] },
  getinpos: { text: "Get in position and wait for my go.", say: ["Get in position and wait for my go."] },
  storm: { text: "Storm the front!", say: ["Storm the front!"] },
  reportin: { text: "Report in, team.", say: ["Report in, team."] },
  affirm: { text: "Affirmative.", say: ["Affirmative.", "Roger that.", "Copy that.", "Roger."] },
  spotted: { text: "Enemy spotted.", say: ["Enemy spotted.", "Contact!", "Enemy spotted!"], loc: true },
  backup: { text: "Need backup!", say: ["Need backup!", "I need backup!"], loc: true },
  clear: { text: "Sector clear.", say: ["Sector clear.", "Clear."], loc: true },
  inpos: { text: "I'm in position.", say: ["I'm in position.", "In position."], loc: true },
  reporting: { text: "Reporting in.", say: ["Reporting in."], loc: true },
  blow: { text: "Get out of there, she's gonna blow!", say: ["Get out of there, she's gonna blow!", "She's gonna blow!"] },
  negative: { text: "Negative.", say: ["Negative.", "No can do."] },
  enemydown: { text: "Enemy down.", say: ["Enemy down.", "Got him!", "Enemy down!"] },
  // said only by the computer soldiers
  onmyway: { text: "On my way.", say: ["On my way.", "Moving."] },
  moveout: { text: "Let's move out.", say: ["Let's move out.", "Let's go."] },
  holdsites: { text: "Get in position, hold the sites.", say: ["Get in position.", "Hold the sites, team."] },
  planted: { text: "Bomb planted", say: ["Bomb's planted!", "The bomb is down!"] },
  rotate: { text: "Rotating", say: ["Rotating."] },
  sawbomb: { text: "Bomb carrier spotted", say: ["They have the bomb!", "Bomb carrier spotted!"], loc: true },
  lastone: { text: "One left!", say: ["One left!", "Last one!"] },
};

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- the voices -----------------------------------------------------------------------------------------------------------------------------
// The Web Speech API is free and offline-capable but every browser and computer has different voices, so each soldier is matched to one of
// the English voices on the machine by his name, with his own pitch and pace. A short queue keeps the radio snappy: old calls are dropped
// rather than read out late. If the browser has no voices, the radio still shows the text and clicks.
function createVoice(getVolume) {
  const ok = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  let voices = [], on = true; try { on = localStorage.getItem("blacksite-radio-voice") !== "0"; } catch {}
  const load = () => { try { const all = window.speechSynthesis.getVoices() || []; const en = all.filter((v) => /^en([-_]|$)/i.test(v.lang || "")); voices = (en.length ? en : all).slice(); voices.sort((a, b) => (a.localService === b.localService ? 0 : a.localService ? -1 : 1)); } catch { voices = []; } };
  if (ok) { load(); try { window.speechSynthesis.addEventListener("voiceschanged", load); } catch {} }
  const queue = []; let busy = false, guard = 0, current = null;
  function next() {
    if (!ok || busy) return; let item = null; while (queue.length) { const q = queue.shift(); if (performance.now() - q.at < 3500) { item = q; break; } } if (!item) return;
    busy = true; const u = new window.SpeechSynthesisUtterance(item.text); const h = hash(item.who);
    if (voices.length) u.voice = voices[h % voices.length]; u.lang = (u.voice && u.voice.lang) || "en-US";
    u.pitch = item.player ? 1.0 : 0.78 + ((h >>> 8) % 9) * 0.05; u.rate = 1.12 + ((h >>> 12) % 5) * 0.04; u.volume = Math.max(0, Math.min(1, getVolume() * 0.95));
    const done = () => { if (current !== u) return; current = null; busy = false; clearTimeout(guard); next(); };
    u.onend = done; u.onerror = done; current = u; clearTimeout(guard); guard = setTimeout(done, 900 + item.text.length * 85); // some browsers never fire onend
    try { window.speechSynthesis.speak(u); } catch { done(); }
  }
  return {
    available: ok,
    get on() { return on; },
    set(v) { on = !!v; try { localStorage.setItem("blacksite-radio-voice", on ? "1" : "0"); } catch {} if (!on) this.stop(); },
    speak(text, who, player = false) { if (!ok || !on || getVolume() <= 0.01) return; if (queue.length >= 2) queue.shift(); queue.push({ text, who, player, at: performance.now() }); next(); },
    stop() { queue.length = 0; busy = false; current = null; clearTimeout(guard); try { if (ok) window.speechSynthesis.cancel(); } catch {} },
  };
}

export function createRadio({ now, sfx, zoneName, getVolume }) {
  const voice = createVoice(getVolume || (() => 1));
  const entries = []; const lastTeam = { terrorist: -9, police: -9 }; const lastKey = {};
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // ent: the speaker. opts.where: {x,z} to name a place (defaults to the speaker); opts.extra: text added after; opts.force: skip the cool-downs;
  // opts.heard: false = the player can't hear it (the other team's radio)
  function say(ent, id, opts = {}) {
    const R = RADIO[id]; if (!R || !ent) return false; const t = now();
    if (!opts.force) { if (t - lastTeam[ent.team] < 1.4) return false; const k = ent.team + id; if (t - (lastKey[k] ?? -99) < (opts.cool ?? 4)) return false; lastKey[k] = t; }
    lastTeam[ent.team] = t;
    let place = ""; if (R.loc || opts.where) { const w = opts.where || ent; place = zoneName(w.x, w.z) || ""; }
    let text = R.text; if (opts.extra) text = text.replace(/[.!]$/, "") + " " + opts.extra; if (place) text += "  @ " + place;
    let spoken = pick(R.say); if (opts.extra) spoken = spoken.replace(/[.!]$/, "") + ", " + opts.extra; if (place && R.loc) spoken += ", " + place.toLowerCase();
    const entry = { t, name: ent.isPlayer ? "You" : ent.name, team: ent.team, text, spoken, you: !!ent.isPlayer, heard: opts.heard !== false };
    entries.push(entry); if (entries.length > 12) entries.shift();
    if (opts.heard !== false) { try { sfx.radio(); } catch {} voice.speak(spoken, ent.name || "you", !!ent.isPlayer); }
    return entry;
  }
  // a line from another player's game (multiplayer): show it and say it
  function addRemote(o) {
    entries.push({ t: now(), name: o.name, team: o.team, text: o.text, spoken: o.spoken, you: !!o.you, heard: true }); if (entries.length > 12) entries.shift();
    try { sfx.radio(); } catch {} if (o.spoken) voice.speak(o.spoken, o.who || o.name, !!o.you);
  }
  return {
    say, addRemote,
    log(team) { const t = now(); return entries.filter((e) => e.heard && e.team === team && t - e.t < 7).slice(-5).map((e) => ({ ...e, age: t - e.t })); },
    get voiceOn() { return voice.on; }, get voiceAvailable() { return voice.available; },
    setVoice(v) { voice.set(v); }, stop() { voice.stop(); }, reset() { entries.length = 0; voice.stop(); },
  };
}
