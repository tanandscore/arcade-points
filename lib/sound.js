"use client";

// Generates short retro "chiptune" beeps on the fly using the Web
// Audio API — no audio files to host, upload, or keep in sync with
// GitHub. Fits the pixel-arcade theme naturally.

let audioCtx = null;
let muted = false;
let initialized = false;

const STORAGE_KEY = "tap-and-score-muted";

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage can throw in some privacy modes — sound just
    // defaults to on for that session, which is a safe fallback.
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // ignore — see note in ensureInitialized
  }
}

function getContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function isMuted() {
  ensureInitialized();
  return muted;
}

export function setMuted(value) {
  ensureInitialized();
  muted = value;
  persist();
}

export function toggleMuted() {
  ensureInitialized();
  muted = !muted;
  persist();
  return muted;
}

function tone({ frequency = 440, duration = 0.15, type = "square", volume = 0.15, glideTo, layered = false } = {}) {
  ensureInitialized();
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  function voice(detuneCents, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.detune.setValueAtTime(detuneCents, ctx.currentTime);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + duration);
    // A short linear attack (was an instant jump to full volume before)
    // avoids the harsh "click" a sudden gain step makes, then decays
    // naturally — this alone makes every sound in the game noticeably
    // cleaner without changing what note is actually playing.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  voice(0, volume);
  // A second, slightly detuned voice underneath — a classic "chorus"
  // trick that turns a single thin beep into something that actually
  // sounds like an instrument. Used for the positive/rewarding sounds
  // where richness matters most; kept off for hit/negative sounds,
  // which read better as a single sharp tone.
  if (layered) voice(8, volume * 0.55);
}

function sequence(notes) {
  let t = 0;
  for (const n of notes) {
    setTimeout(() => tone(n), t);
    t += (n.gap ?? n.duration * 1000) || 120;
  }
}

export const sfx = {
  tap: () => tone({ frequency: 640, duration: 0.06, type: "square", volume: 0.14 }),
  select: () => tone({ frequency: 720, duration: 0.06, type: "triangle", volume: 0.13, layered: true }),
  correct: () => tone({ frequency: 560, duration: 0.13, type: "square", glideTo: 940, volume: 0.16, layered: true }),
  wrong: () => tone({ frequency: 300, duration: 0.22, type: "sawtooth", glideTo: 100, volume: 0.15 }),
  boost: () => tone({ frequency: 440, duration: 0.13, type: "sawtooth", glideTo: 920, volume: 0.15, layered: true }),
  hit: () => tone({ frequency: 190, duration: 0.1, type: "square", volume: 0.16 }),
  win: () =>
    sequence([
      { frequency: 523, duration: 0.1, type: "square", volume: 0.15, layered: true },
      { frequency: 659, duration: 0.1, type: "square", volume: 0.15, layered: true },
      { frequency: 784, duration: 0.24, type: "square", volume: 0.17, layered: true },
    ]),
  newBest: () =>
    sequence([
      { frequency: 523, duration: 0.08, type: "square", volume: 0.15, layered: true },
      { frequency: 659, duration: 0.08, type: "square", volume: 0.15, layered: true },
      { frequency: 784, duration: 0.08, type: "square", volume: 0.15, layered: true },
      { frequency: 1046, duration: 0.28, type: "square", volume: 0.18, layered: true },
    ]),
  lose: () => tone({ frequency: 220, duration: 0.38, type: "sawtooth", glideTo: 70, volume: 0.15 }),
  click: () => tone({ frequency: 440, duration: 0.05, type: "square", volume: 0.09 }),
  // A dedicated fanfare for "level up" moments specifically — distinct
  // from newBest, since a level-up during a still-in-progress run
  // deserves its own unmistakable sound rather than reusing the
  // personal-best cue.
  levelUp: () =>
    sequence([
      { frequency: 392, duration: 0.08, type: "square", volume: 0.14, layered: true },
      { frequency: 523, duration: 0.08, type: "square", volume: 0.15, layered: true },
      { frequency: 659, duration: 0.08, type: "square", volume: 0.16, layered: true },
      { frequency: 784, duration: 0.08, type: "square", volume: 0.16, layered: true },
      { frequency: 1046, duration: 0.32, type: "square", volume: 0.2, layered: true },
    ]),
  celebration: () =>
    sequence([
      { frequency: 523, duration: 0.1, type: "square", volume: 0.16, layered: true },
      { frequency: 659, duration: 0.1, type: "square", volume: 0.16, layered: true },
      { frequency: 784, duration: 0.1, type: "square", volume: 0.16, layered: true },
      { frequency: 1046, duration: 0.1, type: "square", volume: 0.17, layered: true },
      { frequency: 784, duration: 0.08, type: "square", volume: 0.16, layered: true },
      { frequency: 1046, duration: 0.1, type: "square", volume: 0.17, layered: true },
      { frequency: 1318, duration: 0.38, type: "square", volume: 0.2, layered: true },
    ]),
};

// A soft, slowly shifting ambient pad — three low sine tones, each
// gently breathing in volume via its own slow LFO. Used as Dominion's
// background music: call .update() once per animation frame (it just
// reacts to the mute toggle; the notes themselves don't change).
export function createAmbientLoop() {
  const noop = { update() {}, stop() {} };
  if (typeof window === "undefined") return noop;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return noop;

  let ctx;
  let gain;
  try {
    ctx = new Ctx();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    const notes = [110, 146.83, 164.81]; // A2, D3, E3 — an open, calm triad
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const noteGain = ctx.createGain();
      noteGain.gain.value = 0.5;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.15;
      lfo.connect(lfoGain);
      lfoGain.connect(noteGain.gain);

      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start();
      lfo.start();
    });
  } catch {
    return noop;
  }

  let stopped = false;

  return {
    update() {
      if (stopped || !ctx || ctx.state === "closed") return;
      ensureInitialized();
      if (!muted && ctx.state === "suspended") ctx.resume();
      gain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.4);
    },
    stop() {
      if (stopped || !ctx) return;
      stopped = true;
      try {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => {
          try {
            ctx.close();
          } catch {
            // already closed — fine to ignore
          }
        }, 600);
      } catch {
        // ignore
      }
    },
  };
}
// Two slightly detuned sawtooth oscillators (a harsh, buzzy timbre,
// closer to a screaming race engine than a smooth tone) run through a
// lowpass filter whose brightness opens up under acceleration and
// closes down when coasting or braking — call .update() every
// animation frame with the car's current speed and pedal state.
export function createEngineSound() {
  const noop = { update() {}, stop() {} };
  if (typeof window === "undefined") return noop;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return noop;

  let ctx;
  let osc1;
  let osc2;
  let filter;
  let gain;
  try {
    ctx = new Ctx();
    osc1 = ctx.createOscillator();
    osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc2.detune.value = 9;

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 1.1;

    gain = ctx.createGain();
    gain.gain.value = 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
  } catch {
    return noop;
  }

  let stopped = false;

  return {
    // speedRatio: 0..1. mode: "accel" | "brake" | "coast"
    update(speedRatio, mode) {
      if (stopped || !ctx || ctx.state === "closed") return;
      ensureInitialized();
      if (muted) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        return;
      }
      if (ctx.state === "suspended") ctx.resume();

      const clamped = Math.max(0, Math.min(1, speedRatio));
      const baseFreq = 85 + clamped * 330; // idle hum up to a high-revving scream
      osc1.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.06);
      osc2.frequency.setTargetAtTime(baseFreq * 1.006, ctx.currentTime, 0.06);

      let targetGain = 0.045 + clamped * 0.055;
      let targetCutoff = 550 + clamped * 1800;

      if (mode === "accel") {
        targetGain *= 1.25; // louder, brighter under load
        targetCutoff *= 1.5;
      } else if (mode === "brake") {
        targetGain *= 0.55; // quieter, muffled off-throttle
        targetCutoff *= 0.4;
      }

      gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.09);
      filter.frequency.setTargetAtTime(Math.min(targetCutoff, 6000), ctx.currentTime, 0.09);
    },
    stop() {
      if (stopped || !ctx) return;
      stopped = true;
      try {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
            ctx.close();
          } catch {
            // already stopped/closed — fine to ignore
          }
        }, 250);
      } catch {
        // ignore
      }
    },
  };
}

// A full looping chiptune arrangement — not one repeating 2-bar
// phrase, but 4 distinct sections (bright, driving, ascending,
// harmonic-bridge) that play in sequence before the whole thing
// repeats, so the ear keeps hearing something new for a while. Three
// layers: a square-wave bassline, a triangle-wave arpeggiated lead,
// and a short percussive "tick" on the off-beat for drive. Notes are
// scheduled precisely against the AudioContext clock (not setTimeout)
// so the rhythm stays tight over a long loop. ArcadeMusic.js drives
// the on/off toggle for this.
const SECTIONS = [
  // A — bright & bouncy: C – G – Am – F
  {
    bass: [130.81, 0, 130.81, 0, 196.0, 0, 196.0, 0, 220.0, 0, 220.0, 0, 174.61, 0, 174.61, 0],
    lead: [523.25, 659.25, 783.99, 659.25, 392.0, 493.88, 587.33, 493.88, 440.0, 523.25, 659.25, 523.25, 349.23, 440.0, 523.25, 440.0],
  },
  // B — driving & busier: F – C – G – Am
  {
    bass: [174.61, 174.61, 0, 174.61, 130.81, 130.81, 0, 130.81, 196.0, 196.0, 0, 196.0, 220.0, 220.0, 0, 220.0],
    lead: [349.23, 440.0, 523.25, 440.0, 523.25, 659.25, 783.99, 659.25, 392.0, 493.88, 587.33, 493.88, 440.0, 523.25, 659.25, 523.25],
  },
  // C — ascending & triumphant: Am – F – C – G, reaching higher each bar
  {
    bass: [220.0, 0, 220.0, 0, 174.61, 0, 174.61, 0, 130.81, 0, 130.81, 0, 196.0, 0, 196.0, 0],
    lead: [440.0, 523.25, 659.25, 880.0, 349.23, 440.0, 523.25, 698.46, 523.25, 659.25, 783.99, 1046.5, 392.0, 493.88, 587.33, 783.99],
  },
  // D — harmonic bridge for contrast before looping back to A: Dm – G – C – Am
  {
    bass: [146.83, 0, 146.83, 0, 196.0, 0, 196.0, 0, 130.81, 0, 130.81, 0, 220.0, 0, 220.0, 0],
    lead: [293.66, 349.23, 440.0, 349.23, 392.0, 493.88, 587.33, 493.88, 523.25, 659.25, 783.99, 659.25, 440.0, 523.25, 659.25, 523.25],
  },
];
const MUSIC_TEMPO = 128;
const MUSIC_STEP = 60 / MUSIC_TEMPO / 2; // 8th notes
const MUSIC_TARGET_GAIN = 0.55;

export function createArcadeMusic() {
  const noop = { resumeIfNeeded() {}, stop() {} };
  if (typeof window === "undefined") return noop;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return noop;

  let ctx;
  let masterGain;
  try {
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  } catch {
    return noop;
  }

  function playNote(time, freq, type, peakGain, duration) {
    if (!freq) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  let nextStepTime = ctx.currentTime + 0.05;
  let stepIndex = 0;
  function schedule() {
    // Schedules everything due in the next 150ms — running this on a
    // short interval (rather than one note at a time) is the standard
    // "lookahead scheduler" pattern for reliable Web Audio timing.
    while (nextStepTime < ctx.currentTime + 0.15) {
      const sectionLen = SECTIONS[0].bass.length;
      const section = SECTIONS[Math.floor(stepIndex / sectionLen) % SECTIONS.length];
      const step = stepIndex % sectionLen;
      playNote(nextStepTime, section.bass[step], "square", 0.32, MUSIC_STEP * 0.85);
      playNote(nextStepTime, section.lead[step], "triangle", 0.24, MUSIC_STEP * 0.75);
      if (step % 2 === 1) {
        playNote(nextStepTime, 1760, "square", 0.11, 0.035); // off-beat tick for drive
      }
      stepIndex += 1;
      nextStepTime += MUSIC_STEP;
    }
  }
  const schedulerId = setInterval(schedule, 50);
  schedule();

  let stopped = false;
  let lastKnownMuted = null;

  function applyMuteState() {
    if (stopped || ctx.state === "closed") return;
    ensureInitialized();
    if (muted === lastKnownMuted) return;
    lastKnownMuted = muted;
    if (muted) {
      masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    } else {
      if (ctx.state === "suspended") ctx.resume();
      masterGain.gain.setTargetAtTime(MUSIC_TARGET_GAIN, ctx.currentTime, 0.5);
    }
  }
  const pollId = setInterval(applyMuteState, 400);
  applyMuteState();

  return {
    // Call directly inside a click handler — browsers only allow
    // resuming a suspended AudioContext synchronously within a real
    // user gesture, not from a timer callback.
    resumeIfNeeded() {
      if (stopped) return;
      if (ctx.state === "suspended") ctx.resume();
      if (!muted) masterGain.gain.setTargetAtTime(MUSIC_TARGET_GAIN, ctx.currentTime, 0.4);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(schedulerId);
      clearInterval(pollId);
      try {
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => {
          try {
            ctx.close();
          } catch {
            // already closed — fine to ignore
          }
        }, 500);
      } catch {
        // ignore
      }
    },
  };
}

// Kingdoms of Ash's adaptive soundtrack — a gentle, folk-ish loop
// that genuinely differs between day and night (not just volume),
// plus a short triumphant fanfare for kingdom tier-ups. Same
// lookahead-scheduler pattern as createArcadeMusic above, but a much
// slower tempo and sparser, warmer notes fitting a calm kingdom
// simulator rather than an arcade game.
const KINGDOM_TEMPO = 82;
const KINGDOM_STEP = 60 / KINGDOM_TEMPO / 2;
const KINGDOM_DAY_BASS = [110, 0, 110, 0, 146.83, 0, 146.83, 0, 130.81, 0, 130.81, 0, 98, 0, 98, 0];
const KINGDOM_DAY_LEAD = [440, 0, 523.25, 0, 587.33, 0, 523.25, 0, 493.88, 0, 440, 0, 392, 0, 440, 0];
// Night keeps the same harmonic center but drops most of the lead
// line and thins the bass — sparser, lower, more spacious, matching
// a calmer, quieter kingdom at night rather than just turning the
// volume down on the same daytime tune.
const KINGDOM_NIGHT_BASS = [110, 0, 0, 0, 130.81, 0, 0, 0, 98, 0, 0, 0, 110, 0, 0, 0];
const KINGDOM_NIGHT_LEAD = [0, 0, 0, 0, 587.33, 0, 0, 0, 0, 0, 0, 0, 523.25, 0, 0, 0];
const KINGDOM_TARGET_GAIN = 0.3;

export function createKingdomMusic() {
  const noop = { setMood() {}, levelUpFanfare() {}, resumeIfNeeded() {}, stop() {} };
  if (typeof window === "undefined") return noop;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return noop;

  let ctx;
  let masterGain;
  try {
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  } catch {
    return noop;
  }

  let mood = "day"; // "day" | "night" — see setMood()

  function playNote(time, freq, type, peakGain, duration) {
    if (!freq) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  let nextStepTime = ctx.currentTime + 0.05;
  let stepIndex = 0;
  function schedule() {
    while (nextStepTime < ctx.currentTime + 0.15) {
      const bassSeq = mood === "night" ? KINGDOM_NIGHT_BASS : KINGDOM_DAY_BASS;
      const leadSeq = mood === "night" ? KINGDOM_NIGHT_LEAD : KINGDOM_DAY_LEAD;
      const step = stepIndex % bassSeq.length;
      playNote(nextStepTime, bassSeq[step], "sine", 0.22, KINGDOM_STEP * 1.6);
      playNote(nextStepTime, leadSeq[step], "triangle", 0.16, KINGDOM_STEP * 1.3);
      stepIndex += 1;
      nextStepTime += KINGDOM_STEP;
    }
  }
  const schedulerId = setInterval(schedule, 50);
  schedule();

  let stopped = false;
  let lastKnownMuted = null;
  function applyMuteState() {
    if (stopped || ctx.state === "closed") return;
    ensureInitialized();
    if (muted === lastKnownMuted) return;
    lastKnownMuted = muted;
    if (muted) {
      masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    } else {
      if (ctx.state === "suspended") ctx.resume();
      masterGain.gain.setTargetAtTime(KINGDOM_TARGET_GAIN, ctx.currentTime, 0.5);
    }
  }
  const pollId = setInterval(applyMuteState, 400);
  applyMuteState();

  return {
    // Called whenever the game's day-night phase changes — swaps
    // which note sequences the scheduler is pulling from on the fly,
    // no restart or gap needed.
    setMood(newMood) {
      mood = newMood;
    },
    // A short triumphant arpeggio layered on top of the ongoing
    // loop for a kingdom tier-up — doesn't interrupt the music,
    // just adds a few seconds of flourish over it.
    levelUpFanfare() {
      if (stopped) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        playNote(now + i * 0.12, freq, "triangle", 0.28, 0.35);
      });
    },
    resumeIfNeeded() {
      if (stopped) return;
      if (ctx.state === "suspended") ctx.resume();
      if (!muted) masterGain.gain.setTargetAtTime(KINGDOM_TARGET_GAIN, ctx.currentTime, 0.4);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(schedulerId);
      clearInterval(pollId);
      try {
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => {
          try {
            ctx.close();
          } catch {
            // already closed — fine to ignore
          }
        }, 600);
      } catch {
        // ignore
      }
    },
  };
}

// A separate, more intense track for Titan Arena — an original
// composition built around what actually makes fighting-game battle
// music feel dramatic: a low, dissonant driving bassline, a tribal
// two-voice drum pattern (a deep kick + a sharp rim hit), and sparse
// brass-stab accents that punctuate rather than play a full melody.
// This deliberately does NOT reproduce any existing game's actual
// soundtrack — it's original notes built in that same dark,
// percussive style. Same lookahead-scheduler approach as
// createArcadeMusic, so timing stays tight.
const TITAN_BASS = [55, 55, 0, 55, 65.41, 65.41, 0, 65.41, 55, 55, 0, 55, 61.74, 61.74, 0, 61.74];
const TITAN_STAB = [220, 0, 0, 0, 0, 0, 0, 0, 261.63, 0, 0, 0, 0, 0, 246.94, 0];
const TITAN_TEMPO = 150;
const TITAN_STEP = 60 / TITAN_TEMPO / 2;
const TITAN_TARGET_GAIN = 0.58;

export function createBattleMusic() {
  const noop = { resumeIfNeeded() {}, stop() {} };
  if (typeof window === "undefined") return noop;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return noop;

  let ctx;
  let masterGain;
  try {
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  } catch {
    return noop;
  }

  function playNote(time, freq, type, peakGain, duration) {
    if (!freq) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  // A short pitch-dropping thump for the deep kick, and a bright,
  // very short burst for the rim hit — together they read as a real
  // martial drum pattern rather than a single flat tone.
  function playKick(time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.13);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.17);
  }
  function playRim(time) {
    playNote(time, 1400, "square", 0.14, 0.035);
  }

  let nextStepTime = ctx.currentTime + 0.05;
  let stepIndex = 0;
  function schedule() {
    while (nextStepTime < ctx.currentTime + 0.15) {
      const step = stepIndex % TITAN_BASS.length;
      playNote(nextStepTime, TITAN_BASS[step], "sawtooth", 0.32, TITAN_STEP * 0.9);
      if (TITAN_STAB[step]) {
        playNote(nextStepTime, TITAN_STAB[step], "square", 0.28, TITAN_STEP * 3.2);
      }
      // Tribal drum layer — kick on the strong beats, rim on the offbeats
      if (step % 4 === 0) playKick(nextStepTime);
      if (step % 4 === 2) playRim(nextStepTime);
      stepIndex += 1;
      nextStepTime += TITAN_STEP;
    }
  }
  const schedulerId = setInterval(schedule, 50);
  schedule();

  let stopped = false;
  let lastKnownMuted = null;

  function applyMuteState() {
    if (stopped || ctx.state === "closed") return;
    ensureInitialized();
    if (muted === lastKnownMuted) return;
    lastKnownMuted = muted;
    if (muted) {
      masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    } else {
      if (ctx.state === "suspended") ctx.resume();
      masterGain.gain.setTargetAtTime(TITAN_TARGET_GAIN, ctx.currentTime, 0.5);
    }
  }
  const pollId = setInterval(applyMuteState, 400);
  applyMuteState();

  return {
    resumeIfNeeded() {
      if (stopped) return;
      if (ctx.state === "suspended") ctx.resume();
      if (!muted) masterGain.gain.setTargetAtTime(TITAN_TARGET_GAIN, ctx.currentTime, 0.4);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(schedulerId);
      clearInterval(pollId);
      try {
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => {
          try {
            ctx.close();
          } catch {
            // already closed — fine to ignore
          }
        }, 500);
      } catch {
        // ignore
      }
    },
  };
}

// Per-character combat sounds — each fighter's punch/kick/special all
// derive from one small "voice" profile (base frequency, waveform,
// and glide direction), so every character has an audibly distinct
// combat voice without needing dozens of individually hand-tuned
// sounds. Titan Arena passes each fighter's own profile in here.
export function characterPunch(profile) {
  tone({
    frequency: profile.freq,
    duration: 0.09,
    type: profile.type,
    glideTo: profile.glideUp ? profile.freq * 1.6 : profile.freq * 0.6,
    volume: 0.18,
    layered: true,
  });
}

export function characterKick(profile) {
  tone({
    frequency: profile.freq * 0.85,
    duration: 0.14,
    type: profile.type,
    glideTo: profile.glideUp ? profile.freq * 1.3 : profile.freq * 0.45,
    volume: 0.19,
    layered: true,
  });
}

export function characterSpecial(profile) {
  sequence([
    { frequency: profile.freq * 0.8, duration: 0.08, type: profile.type, volume: 0.16, layered: true },
    { frequency: profile.freq * 1.1, duration: 0.08, type: profile.type, volume: 0.18, layered: true },
    { frequency: profile.freq * (profile.glideUp ? 1.6 : 0.5), duration: 0.3, type: profile.type, volume: 0.22, layered: true },
  ]);
}

// A short, distinct melodic stinger played once when a match begins
// on a given map — a real, if brief, piece of identity per map,
// built from the same oscillator synthesis as every other sound in
// the game rather than an audio file.
const MAP_INTRO_STINGERS = {
  // One stinger per map, matching each map's theme: warm/organic
  // tones for the jungle facility, metallic/industrial for the
  // storm-battered harbor, and a lower, tenser register for the
  // volcanic complex — not just three arbitrary tone rows.
  blacksite_alpha: [{ frequency: 233, duration: 0.2, type: "triangle" }, { frequency: 294, duration: 0.2, type: "triangle" }, { frequency: 349, duration: 0.42, type: "triangle", layered: true }],
  tempest_harbor: [{ frequency: 165, duration: 0.22, type: "sawtooth" }, { frequency: 196, duration: 0.22, type: "sawtooth" }, { frequency: 247, duration: 0.45, type: "sawtooth", layered: true }],
  ashfall_research: [{ frequency: 130, duration: 0.24, type: "square" }, { frequency: 155, duration: 0.24, type: "square" }, { frequency: 98, duration: 0.5, type: "square", layered: true }],
};

export function playMapIntro(mapId) {
  sequence(MAP_INTRO_STINGERS[mapId] || MAP_INTRO_STINGERS.blacksite_alpha);
}

// A genuine looping ambient background — sustained oscillators held
// open (not the fire-and-forget one-shot `tone()` used everywhere
// else) with their own gain node, so it can fade in, keep running,
// and fade out cleanly when swapped. This is an ambient drone/pad,
// not an orchestral score — an honest description of what's
// achievable with synthesis rather than recorded instruments.
let ambientNodes = null;

const AMBIENT_PROFILES = {
  dunes: { freqs: [110, 165], type: "sine", vol: 0.032 }, // warm, low, sun-baked
  vale: { freqs: [98, 147, 220], type: "sine", vol: 0.028 }, // watery, layered
  peaks: { freqs: [220, 330, 440], type: "triangle", vol: 0.024 }, // crystalline, night air
  starlitshore: { freqs: [130, 195, 260], type: "sine", vol: 0.026 },
};

export function startAmbient(profileId) {
  ensureInitialized();
  stopAmbient();
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const profile = AMBIENT_PROFILES[profileId] || AMBIENT_PROFILES.dunes;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(profile.vol, ctx.currentTime + 1.5);
  gain.connect(ctx.destination);

  const oscs = profile.freqs.map((f) => {
    const osc = ctx.createOscillator();
    osc.type = profile.type;
    osc.frequency.setValueAtTime(f, ctx.currentTime);
    osc.connect(gain);
    osc.start();
    return osc;
  });

  ambientNodes = { oscs, gain };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const { oscs, gain } = ambientNodes;
  const ctx = getContext();
  if (ctx) {
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    setTimeout(() => oscs.forEach((o) => { try { o.stop(); } catch {} }), 900);
  } else {
    oscs.forEach((o) => { try { o.stop(); } catch {} });
  }
  ambientNodes = null;
}
