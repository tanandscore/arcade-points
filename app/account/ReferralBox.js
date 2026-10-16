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
    <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
      <h2 className="font-pixel text-[10px] text-accentAmber mb-2">INVITE FRIENDS</h2>
      <p className="text-textDim text-xs mb-4">
        Get 30 days of free Power Pass access for every friend who signs up with your link.
      </p>
      {bonusActive && (
        <p className="text-[11px] text-accentCyan mb-4">
          🎁 You have free Power Pass access until {new Date(bonusUntil).toLocaleDateString()}.
        </p>
      )}
      {link ? (
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded-md px-3 py-2.5 outline-none text-xs bg-bgDeep border border-lineColor text-textLight font-mono"
          />
          <button
            onClick={handleCopy}
            className="font-mono text-[10px] px-4 rounded-md bg-accentCyan text-bgDeep shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="text-textDim text-xs">Your referral link will appear here.</p>
      )}
    </div>
  );
}
