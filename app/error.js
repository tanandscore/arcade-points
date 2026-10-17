"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => { try { console.error(error); } catch {} }, [error]);
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 text-textLight">
      <p className="text-5xl mb-4">⚡</p>
      <h1 className="font-display font-bold text-2xl mb-2">Something tripped up</h1>
      <p className="text-textDim text-sm mb-6 max-w-sm">Nothing you did wrong. Try again, and if it keeps happening, tell us from the feedback page.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button type="button" onClick={() => reset()} className="font-mono text-[11px] px-5 py-2.5 rounded-md bg-accentCyan text-bgDeep">Try again</button>
        <Link href="/feedback" className="font-mono text-[11px] px-5 py-2.5 rounded-md border border-lineColor text-textDim">Report it</Link>
      </div>
    </div>
  );
}
