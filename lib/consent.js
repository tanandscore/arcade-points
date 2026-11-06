"use client";
import { useEffect, useState } from "react";
import { CONSENT_KEY, POLICY_VERSION } from "@/lib/compliance";

// Reads the visitor's cookie / analytics choice (kept only in this browser). Returns null until the visitor has chosen.
export function readConsent() {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c && typeof c.analytics === "boolean" ? c : null;
  } catch { return null; }
}

// "Global Privacy Control" / "Do Not Track" are browser signals that mean "don't track me": we treat them as a No.
export function privacySignalOn() {
  try { return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1"; } catch { return false; }
}

export function saveConsent(analytics) {
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: !!analytics, v: POLICY_VERSION, t: Date.now() })); } catch {}
  window.dispatchEvent(new Event("ts-consent-change"));
}

// true only when the visitor said yes to analytics (and no privacy signal is on)
export function useAnalyticsConsent() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const sync = () => { const c = readConsent(); setOk(!!(c && c.analytics) && !privacySignalOn()); };
    sync();
    window.addEventListener("ts-consent-change", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("ts-consent-change", sync); window.removeEventListener("storage", sync); };
  }, []);
  return ok;
}
