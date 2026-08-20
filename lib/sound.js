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
