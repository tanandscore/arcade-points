// Real browser text-to-speech (SpeechSynthesis API) — no audio files,
// no new dependency, genuinely spoken by the browser's own voice
// engine. Quality and available voices vary by browser/OS (this is
// "best effort" system TTS, not a recorded voice actor), so lines
// are kept short and unambiguous rather than trying to sound
// scripted.
export function speak(text, opts = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // don't let overlapping lines queue up and lag behind the action
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate ?? 1.05;
    utter.pitch = opts.pitch ?? 1;
    utter.volume = opts.volume ?? 0.75;
    window.speechSynthesis.speak(utter);
  } catch {
    // TTS isn't available in every environment — fail silently, the
    // game still works without it
  }
}

export function speakRandom(lines, opts) {
  speak(lines[Math.floor(Math.random() * lines.length)], opts);
}
