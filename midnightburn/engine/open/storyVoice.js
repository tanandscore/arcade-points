// Midnight Burn — story voices (Upgrade 62). Every line of dialogue is spoken aloud with the browser's own speech voices (free, no
// downloads, works offline). Each character gets their own voice: a male or female voice where the browser has both, plus their own
// pitch and pace, so the caller sounds low and slow, young Static high and quick, and so on. The best voices are picked first
// (Edge "Natural" and Google voices sound far more human than the old system ones). If the browser has no speech at all, the story
// simply plays with on-screen text as before.

const PREF = "mb-story-voice";
// [gender, pitch, rate, accent preference]. Pitch 1 and rate 1 are the voice's natural sound.
const CHARS = {
  you: ["m", 1.0, 1.04], unknown: ["m", 0.62, 0.86], ghost: ["m", 0.8, 0.95], static: ["f", 1.06, 1.08], staticLive: ["f", 1.06, 1.08],
  nav: ["f", 1.45, 1.14], saffron: ["f", 0.92, 1.0], lantern: ["f", 1.0, 0.94], hammer: ["m", 0.55, 0.9], collector: ["m", 0.74, 0.84],
  champion: ["m", 0.9, 1.06], narr: ["m", 0.85, 0.92],
};
const FEMALE = /female|woman|zira|aria|jenny|sonia|libby|samantha|victoria|karen|moira|tessa|fiona|serena|neerja|swara|heera|ava|emma|michelle|natasha|clara|hazel|susan|catherine|nanami|kyoko|mizuki|google uk english female|google us english/i;
const MALE = /\bmale\b|\bman\b|david|guy|ryan|daniel|george|mark|james|alex|fred|oliver|thomas|prabhat|ravi|hemant|madhur|christopher|eric|roger|steffan|william|keita|ichiro|google uk english male/i;

export function createStoryVoice(opts = {}) {
  const synth = typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null;
  let on = true; try { const v = localStorage.getItem(PREF); if (v === "off") on = false; } catch {}
  let voices = [], cast = {}, current = null, muted = typeof opts.isMuted === "function" ? opts.isMuted : () => false;
  const lang = opts.lang || "en";

  function score(v) { // higher = sounds more human
    let s = 0; const n = v.name || "";
    if (/natural|neural|online/i.test(n)) s += 50; if (/google/i.test(n)) s += 30; if (/premium|enhanced/i.test(n)) s += 25;
    if (/^en[-_](IN)/i.test(v.lang)) s += opts.india ? 14 : 6; if (/^en[-_](GB)/i.test(v.lang)) s += 10; if (/^en[-_](US)/i.test(v.lang)) s += 8; if (/^en/i.test(v.lang)) s += 5;
    if (v.localService === false) s += 3; return s;
  }
  function pick() {
    if (!synth) return; voices = synth.getVoices().filter((v) => /^en/i.test(v.lang)); if (!voices.length) voices = synth.getVoices();
    const ranked = [...voices].sort((a, b) => score(b) - score(a));
    const fem = ranked.filter((v) => FEMALE.test(v.name) && !MALE.test(v.name)), mal = ranked.filter((v) => MALE.test(v.name));
    const any = ranked[0] || null; cast = {}; const used = { m: 0, f: 0 };
    for (const [id, [g]] of Object.entries(CHARS)) {
      const pool = g === "f" ? (fem.length ? fem : ranked) : (mal.length ? mal : ranked);
      // give the main characters different voices where there are enough of them; the caller and Ghost share one on purpose
      let k = 0; if (id === "ghost" || id === "unknown") k = 0; else if (id === "you") k = Math.min(1, pool.length - 1); else if (id === "hammer" || id === "collector") k = Math.min(2, pool.length - 1); else { k = used[g] % Math.max(1, pool.length); used[g]++; }
      cast[id] = pool[k] || any;
    }
  }
  if (synth) { pick(); try { synth.addEventListener ? synth.addEventListener("voiceschanged", pick) : (synth.onvoiceschanged = pick); } catch {} }

  function stop() { current = null; if (synth) try { synth.cancel(); } catch {} }
  /** Speak a line as a character. Calls onEnd when it has finished (or straight away if voices are off or unavailable). */
  function say(who, text, onEnd) {
    stop();
    const done = () => { if (onEnd) { const f = onEnd; onEnd = null; f(); } };
    if (!synth || !on || muted() || !text || /^[.…\s]+$/.test(text)) { setTimeout(done, 0); return false; }
    if (!voices.length) pick();
    if (!voices.length) { setTimeout(done, 0); return false; } // no voices installed (or not loaded yet): text only
    const c = CHARS[who] || CHARS.you; const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, "…"));
    const v = cast[who]; if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
    u.pitch = c[1]; u.rate = c[2] * (opts.rate || 1); u.volume = who === "unknown" || who === "ghost" || who === "nav" || who === "saffron" ? 0.85 : 1;
    const me = {}; current = me;
    u.onend = () => { if (current === me) current = null; done(); };
    u.onerror = () => { if (current === me) current = null; done(); };
    try { synth.speak(u); } catch { done(); return false; }
    // some browsers never fire onend for very short lines: a safety net based on how long the line should take
    setTimeout(() => { if (current === me) { current = null; done(); } }, 1500 + text.length * 95 / Math.max(0.6, u.rate));
    return true;
  }
  return {
    say, stop,
    get speaking() { return !!current; },
    get available() { return !!synth; },
    get on() { return on; },
    set on(v) { on = !!v; try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {} if (!on) stop(); },
    pause() { if (synth) try { synth.pause(); } catch {} },
    resume() { if (synth) try { synth.resume(); } catch {} },
    get voiceNames() { return Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v ? v.name : null])); },
  };
}
