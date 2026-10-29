"use client";

import { useState } from "react";

export default function ReferralBox({ referralCode, bonusUntil }) {
  const [copied, setCopied] = useState(false);
  const link = referralCode ? `https://tapandscore.com/signup?ref=${referralCode}` : null;
  const bonusActive = bonusUntil && new Date(bonusUntil) > new Date();

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permissions can fail silently in some browsers — the
      // link is still visible and selectable by hand either way
    }
  }

  return (
    <section className="st-panel p-5 sm:p-6" aria-labelledby="invite-h">
      <h2 id="invite-h" className="st-h3">Invite friends</h2>
      <p className="st-muted text-[13.5px] mt-1.5 leading-relaxed">
        Get 30 days of free Power Pass access for every friend who signs up with your link.
      </p>
      {bonusActive && (
        <p className="text-[13.5px] text-accentCyan mt-3">
          You have free Power Pass access until {new Date(bonusUntil).toLocaleDateString()}.
        </p>
      )}
      {link ? (
        <div className="flex gap-2 mt-4">
          <input
            readOnly
            value={link}
            aria-label="Your invite link"
            onFocus={(e) => e.target.select()}
            className="st-input !h-11 !text-[13px] min-w-0 flex-1"
          />
          <button type="button" onClick={handleCopy} className="st-btn st-btn-primary st-btn-sm !h-11 shrink-0">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="st-muted text-[13.5px] mt-4">Your invite link will appear here.</p>
      )}
    </section>
  );
}
