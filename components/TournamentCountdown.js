"use client";

import { useRouter } from "next/navigation";
import CountdownTimer from "./CountdownTimer";

// The tournaments page is a server component, so it has no way to
// react on its own when a countdown hits zero — it only knows a
// tournament's status (upcoming/active/ended) from data fetched at
// the last page load. CountdownTimer already supports an onComplete
// callback but nothing on the tournament page was passing one, so a
// tournament genuinely never moved from "upcoming" to "live" in the
// browser until the player manually reloaded. This thin client
// wrapper is the fix: router.refresh() re-runs the server component
// with fresh data the moment the countdown ends, without a full page
// reload.
export default function TournamentCountdown({ targetIso, size }) {
  const router = useRouter();
  return <CountdownTimer targetIso={targetIso} size={size} onComplete={() => router.refresh()} />;
}
