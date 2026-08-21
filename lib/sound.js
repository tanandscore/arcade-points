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

function tone({ frequency = 440, duration = 0.15, type = "square", volume = 0.15, glideTo } = {}) {
  ensureInitialized();
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function sequence(notes) {
  let t = 0;
  for (const n of notes) {
    setTimeout(() => tone(n), t);
    t += (n.gap ?? n.duration * 1000) || 120;
  }
}

export const sfx = {
  tap: () => tone({ frequency: 640, duration: 0.07, type: "square" }),
  select: () => tone({ frequency: 720, duration: 0.06, type: "triangle" }),
  correct: () => tone({ frequency: 520, duration: 0.14, type: "square", glideTo: 900 }),
  wrong: () => tone({ frequency: 300, duration: 0.22, type: "sawtooth", glideTo: 110 }),
  boost: () => tone({ frequency: 440, duration: 0.12, type: "sawtooth", glideTo: 880 }),
  hit: () => tone({ frequency: 200, duration: 0.1, type: "square" }),
  win: () =>
    sequence([
      { frequency: 523, duration: 0.11, type: "square" },
      { frequency: 659, duration: 0.11, type: "square" },
      { frequency: 784, duration: 0.22, type: "square" },
    ]),
  newBest: () =>
    sequence([
      { frequency: 523, duration: 0.09, type: "square" },
      { frequency: 659, duration: 0.09, type: "square" },
      { frequency: 784, duration: 0.09, type: "square" },
      { frequency: 1046, duration: 0.25, type: "square" },
    ]),
  lose: () => tone({ frequency: 220, duration: 0.35, type: "sawtooth", glideTo: 80 }),
  click: () => tone({ frequency: 440, duration: 0.05, type: "square", volume: 0.1 }),
  celebration: () =>
    sequence([
      { frequency: 523, duration: 0.1, type: "square" },
      { frequency: 659, duration: 0.1, type: "square" },
      { frequency: 784, duration: 0.1, type: "square" },
      { frequency: 1046, duration: 0.1, type: "square" },
      { frequency: 784, duration: 0.08, type: "square" },
      { frequency: 1046, duration: 0.1, type: "square" },
      { frequency: 1318, duration: 0.35, type: "square" },
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

// A looping chiptune track — a driving square-wave bassline under an
// arpeggiated triangle-wave lead, cycling through an Am–F–C–G
// progression (the classic "retro arcade" chord pattern). Notes are
// scheduled precisely against the AudioContext clock rather than with
// setTimeout, so the rhythm actually stays tight over a long loop.
// Used for ambient background music on the landing page and dashboard
// — ArcadeMusic.js drives the on/off toggle for this.
const BASS_PATTERN = [110, 0, 110, 0, 87.31, 0, 87.31, 0, 130.81, 0, 130.81, 0, 98, 0, 98, 0];
const LEAD_PATTERN = [
  440, 523.25, 659.25, 523.25,
  349.23, 440, 523.25, 440,
  523.25, 659.25, 783.99, 659.25,
  392, 493.88, 587.33, 493.88,
];
const MUSIC_TEMPO = 126;
const MUSIC_STEP = 60 / MUSIC_TEMPO / 2; // 8th notes
const MUSIC_TARGET_GAIN = 0.16;

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
      playNote(nextStepTime, BASS_PATTERN[stepIndex % BASS_PATTERN.length], "square", 0.22, MUSIC_STEP * 0.85);
      playNote(nextStepTime, LEAD_PATTERN[stepIndex % LEAD_PATTERN.length], "triangle", 0.14, MUSIC_STEP * 0.75);
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
