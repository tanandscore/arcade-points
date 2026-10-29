"use client";
import Link from "next/link";

// Account page: the privacy tools in one place (download my data, cookie choices, policy). Delete-account sits right below it.
export default function PrivacyDataSection() {
  return (
    <section className="st-panel p-5 sm:p-6" aria-labelledby="privacy-h">
      <h2 id="privacy-h" className="st-h3">Privacy and your data</h2>
      <p className="st-muted text-[13.5px] mt-1.5 leading-relaxed">You control your information. Download a copy of everything we hold about you, change your cookie choices, or read exactly how your data is used.</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <a href="/api/account/export" className="st-btn st-btn-primary st-btn-sm">Download my data</a>
        <button type="button" onClick={() => window.dispatchEvent(new Event("ts-open-consent"))} className="st-btn st-btn-ghost st-btn-sm">Cookie settings</button>
        <Link href="/privacy#rights" className="st-btn st-btn-ghost st-btn-sm">Your rights</Link>
      </div>
    </section>
  );
}
