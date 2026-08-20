"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

export default function Navbar({ username, points }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative px-4 py-3 sm:px-6 sm:py-4 border-b border-lineColor bg-bgPanel">
      <div className="flex justify-center gap-2 mb-2">
        {new Array(18).fill(0).map((_, i) => {
          const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
          return (
            <span
              key={i}
              className="ap-marquee-light inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color, color, animationDelay: `${(i % 6) * 0.12}s` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
        <Link href={username ? "/dashboard" : "/"} className="font-pixel text-sm sm:text-base text-textLight">
          TAP & SCORE
        </Link>
        {username ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase text-textDim">{username}</div>
              <div className="font-mono text-sm font-semibold text-accentAmber">
                {(points || 0).toLocaleString()} PTS
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href="/login" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim">
              Log in
            </Link>
            <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
