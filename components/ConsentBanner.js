"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, saveConsent, privacySignalOn } from "@/lib/consent";

// Asks once, plainly: essential-only or also allow anonymous analytics. Nothing optional runs before a "yes".
// A visitor whose browser sends "Global Privacy Control" / "Do Not Track" is treated as having said no, and is not nagged.
export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (privacySignalOn()) { if (!readConsent()) saveConsent(false); return undefined; }
    if (!readConsent()) setShow(true);
    return undefined;
  }, []);
  useEffect(() => {
    const open = () => setShow(true);
    window.addEventListener("ts-open-consent", open);
    return () => window.removeEventListener("ts-open-consent", open);
  }, []);
  if (!show) return null;
  const choose = (v) => { saveConsent(v); setShow(false); };
  return (
    <div role="dialog" aria-label="Privacy choices" className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto rounded-xl border border-lineColor bg-bgPanel shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-[13px] text-textLight/90 leading-relaxed flex-1">
          We use a few essential cookies to keep you signed in. With your OK, we also use anonymous analytics to see which pages are slow or popular — no ads, no selling your data.{" "}
          <Link href="/privacy#cookies" className="text-accentCyan underline">Details</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => choose(false)} className="font-mono text-[11px] px-4 py-2.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3">Essential only</button>
          <button type="button" onClick={() => choose(true)} className="font-mono text-[11px] px-4 py-2.5 rounded-md bg-accentCyan text-bgDeep font-bold">Allow analytics</button>
        </div>
      </div>
    </div>
  );
}
