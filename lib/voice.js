// Real browser text-to-speech (SpeechSynthesis API) — no audio files,
// no new dependency, genuinely spoken by the browser's own voice
// engine. Quality and available voices vary by browser/OS (this is
// "best effort" system TTS, not a recorded voice actor), so lines
// are kept short and unambiguous rather than trying to sound
// scripted.
//
// Two real bugs fixed here, not just cosmetic changes:
//
// 1. Every speak() call used to unconditionally cancel whatever was
//    currently playing before starting. That's fine for ambient
//    chatter, but a critical line like "Bomb has been planted" could
//    get cut off moments later by something as routine as "Enemy
//    defusing the bomb!" firing when a bot reaches the bomb — which
//    happens almost immediately after a plant. Fixed with a real
//    priority system: high-priority lines can't be interrupted by a
//    normal-priority one still competing for the same breath of air.
//
// 2. A well-documented Chrome bug: if nothing keeps a reference to
//    the SpeechSynthesisUtterance object alive, V8's garbage
//    collector can reclaim it mid-utterance (or before it ever
//    starts), producing silence with no error. A module-level
//    reference is the standard fix. Chrome also loads its voice list
//    asynchronously — calling speak() before that finishes can
//    silently produce nothing on the very first line of a session,
//    which is exactly the kind of "critical early line goes missing"
//    symptom this bug reports. Pre-warming the voice list on load
//    fixes that.

let currentUtterance = null;
let currentPriority = "normal";

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Triggers Chrome's async voice list load early, well before any
  // real game line needs to go out.
  window.speechSynthesis.getVoices();
}

export function speak(text, opts = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const priority = opts.priority === "high" ? "high" : "normal";

  // A normal-priority line never interrupts a high-priority one
  // that's still actually speaking — it's simply dropped, rather
  // than cutting off something more important than itself.
  if (priority === "normal" && currentPriority === "high" && window.speechSynthesis.speaking) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate ?? 1.05;
    utter.pitch = opts.pitch ?? 1;
    utter.volume = opts.volume ?? 0.75;
    utter.onend = () => {
      if (currentUtterance === utter) {
        currentUtterance = null;
        currentPriority = "normal";
      }
    };
    currentUtterance = utter; // kept alive on purpose — see the GC note above
    currentPriority = priority;
    window.speechSynthesis.speak(utter);
  } catch {
    // TTS isn't available in every environment — fail silently, the
    // game still works without it
  }
}

export function speakRandom(lines, opts) {
  speak(lines[Math.floor(Math.random() * lines.length)], opts);
}
