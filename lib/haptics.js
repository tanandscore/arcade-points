"use client";

// A tiny wrapper around the Vibration API — this is what makes button
// taps feel like a native app instead of a webpage. Silently does
// nothing on devices/browsers without support (iOS Safari notably
// doesn't support this yet), so it's always safe to call.
export function haptic(pattern = 10) {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore — vibration is a nice-to-have, never worth erroring over
  }
}

export const haptics = {
  tap: () => haptic(8),
  select: () => haptic(12),
  success: () => haptic([10, 40, 10]),
  celebrate: () => haptic([15, 60, 15, 60, 25]),
};
