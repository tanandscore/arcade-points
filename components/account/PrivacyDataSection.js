"use client";
import Link from "next/link";

// Account page: the privacy tools in one place (download my data, cookie choices, policy). Delete-account sits right below it.
export default function PrivacyDataSection() {
  return (
    <div className="rounded-xl border border-lineColor bg-bgPanel p-5">
      <h2 className="font-pixel text-[10px] text-accentCyan mb-2">PRIVACY & YOUR DATA</h2>
      <p className="text-textDim text-[13px] leading-relaxed mb-4">You control your information. Download a copy of everything we hold about you, change your cookie choices, or read exactly how your data is used.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/account/export" className="font-mono text-[11px] px-4 py-2.5 rounded-md bg-accentCyan text-bgDeep font-bold">⬇ Download my data</a>
        <button type="button" onClick={() => window.dispatchEvent(new Event("ts-open-consent"))} className="font-mono text-[11px] px-4 py-2.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3">Cookie settings</button>
        <Link href="/privacy#rights" className="font-mono text-[11px] px-4 py-2.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3">Your rights</Link>
      </div>
    </div>
  );
}
