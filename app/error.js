"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => { try { console.error(error); } catch {} }, [error]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center text-textLight">
      <h1 className="st-h1" style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)" }}>Something went wrong</h1>
      <p className="st-muted mt-3 max-w-md text-[16px] leading-relaxed">Nothing you did wrong. Try again, and if it keeps happening, tell us from the feedback page.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="st-btn st-btn-primary">Try again</button>
        <Link href="/feedback" className="st-btn st-btn-ghost">Report it</Link>
      </div>
    </div>
  );
}
