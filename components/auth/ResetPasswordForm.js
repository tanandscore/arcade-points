"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";

// Every kind of link this page can be opened with (Supabase's own emailed link and our own /auth/confirm link):
//   #access_token=...&type=recovery     the usual emailed link. The sign-in token rides in the part after "#", so it works in ANY browser or phone.
//   ?token_hash=...&type=recovery       our own link style (set up in the Supabase email template, see README). Checked only when the person presses Save,
//                                       so email programs that "open links to check them" cannot use it up.
//   ?code=...                           the older "same browser only" style (links already sitting in old emails).
//   #error=...&error_code=otp_expired   Supabase telling us the link is used up or too old.
//   ?mode=code                          typing the code from the email instead of using a link.
function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (k) => h.get(k) || q.get(k) || "";
  return {
    tokenHash: q.get("token_hash") || "",
    code: q.get("code") || "",
    mode: q.get("mode") || "",
    email: q.get("email") || "",
    err: get("error_code") || get("error"),
    errDesc: get("error_description"),
    accessToken: h.get("access_token") || "",
    refreshToken: h.get("refresh_token") || "",
    type: h.get("type") || q.get("type") || "",
  };
}

const EXPIRED = "This reset link has already been used or has expired. Each link works once and stops working after about an hour. Some email apps also open links automatically to check them, which uses them up.";

// turns Supabase's wording into something a player can act on
function friendly(message) {
  const m = String(message || "");
  if (/expired|invalid|already been used|not found/i.test(m)) return EXPIRED;
  if (/session missing|not authenticated|jwt/i.test(m)) return "Your reset session has ended. Please request a new link.";
  return m || "Something went wrong. Please try again.";
}

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("checking"); // checking | ready | problem | done
  const [mode, setMode] = useState("session"); // session (already signed in by the link) | hash (token_hash in the link) | code (typed code)
  const [problem, setProblem] = useState("");
  const tokenRef = useRef("");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const u = readUrl();
    let alive = true, timer = null;
    if (u.err || u.errDesc) { setProblem(friendly(u.errDesc || u.err)); setPhase("problem"); return; }
    if (u.mode === "code") { setMode("code"); if (u.email) setEmail(u.email); setPhase("ready"); return; }
    if (u.tokenHash) { tokenRef.current = u.tokenHash; setMode("hash"); setPhase("ready"); return; }
    // The usual emailed link carries the sign-in token after the "#". The browser library on this site is set to the stricter
    // same-browser style and would ignore such a link, so it is read here and turned into a session directly.
    if (u.accessToken && u.refreshToken && u.type === "recovery") {
      supabase.auth
        .setSession({ access_token: u.accessToken, refresh_token: u.refreshToken })
        .then(({ data, error: sErr }) => {
          if (!alive) return;
          try { window.history.replaceState(null, "", "/reset-password"); } catch {}
          if (sErr || !data?.session) { setProblem(friendly(sErr?.message || "invalid")); setPhase("problem"); return; }
          setMode("session");
          setPhase("ready");
        })
        .catch(() => { if (alive) { setProblem("We couldn't reach the server. Check your connection and try the link again."); setPhase("problem"); } });
      return () => { alive = false; };
    }
    // Otherwise (an older "?code=" link, or just opening this page) wait for the library to find a session, but not forever.
    const ready = () => { if (alive) { setMode("session"); setPhase("ready"); } };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) ready();
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) ready(); });
    timer = setTimeout(() => {
      if (!alive) return;
      setPhase((p) => {
        if (p !== "checking") return p;
        setProblem(u.code
          ? "This link was opened in a different browser or app from the one that asked for the reset, so it can't be finished here. Request a new link and open it on the same device and browser, or use the code option below."
          : "This page needs the link from your reset email. Open the email and tap the link again, or request a new one.");
        return "problem";
      });
    }, 7000);
    return () => { alive = false; clearTimeout(timer); listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (mode === "code" && (!email.trim() || otp.replace(/\s/g, "").length < 6)) { setError("Enter the email address and the code from the email."); return; }
    if (password.length < 6) { setError("Password needs to be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      // the link / code is only used up now, at the moment the person actually saves
      if (mode === "hash") {
        const { error: vErr } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenRef.current });
        if (vErr) { setLoading(false); setProblem(friendly(vErr.message)); setPhase("problem"); return; }
      } else if (mode === "code") {
        const { error: vErr } = await supabase.auth.verifyOtp({ type: "recovery", email: email.trim(), token: otp.replace(/\s/g, "") });
        if (vErr) { setLoading(false); setError(friendly(vErr.message)); return; }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setLoading(false); setError(friendly(updateError.message)); return; }
    } catch (ex) {
      setLoading(false);
      setError("We couldn't reach the server. Check your connection and try again.");
      return;
    }
    setLoading(false);
    setPhase("done");
    try { window.history.replaceState(null, "", "/reset-password"); } catch {}
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  const input = "w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors";
  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar />
      <div
        className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 65%)" }}
      >
        {phase === "done" ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentCyan mb-4">PASSWORD UPDATED</div>
            <p className="text-textDim text-sm">Taking you to your dashboard...</p>
          </div>
        ) : phase === "checking" ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentAmber mb-4">CHECKING YOUR LINK...</div>
            <p className="text-textDim text-sm mb-6">This only takes a moment.</p>
          </div>
        ) : phase === "problem" ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentMagenta mb-4">THIS LINK DIDN&apos;T WORK</div>
            <p className="text-textDim text-sm mb-6">{problem}</p>
            <Link href="/forgot-password" className="inline-block font-pixel text-[10px] px-5 py-3 rounded-md bg-accentCyan text-bgDeep">
              REQUEST A NEW LINK ▸
            </Link>
            <div className="mt-5">
              <button type="button" onClick={() => { setError(""); setMode("code"); setPhase("ready"); }} className="font-mono text-xs text-accentCyan">
                My email shows a code ▸
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-pixel text-xl sm:text-2xl text-textLight mb-8 text-center">SET A NEW PASSWORD</h1>
            <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-lineColor p-7 bg-bgPanel shadow-xl">
              {mode === "code" && (
                <>
                  <p className="text-textDim text-xs mb-4">Enter the email address on your account and the code from the reset email.</p>
                  <label className="block font-mono text-xs mb-2 text-textDim">EMAIL</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} placeholder="you@example.com" />
                  <label className="block font-mono text-xs mb-2 text-textDim">CODE FROM THE EMAIL</label>
                  <input type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} required autoComplete="one-time-code" className={input} placeholder="123456" />
                </>
              )}
              <label className="block font-mono text-xs mb-2 text-textDim">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={input}
                placeholder="At least 6 characters"
              />
              <label className="block font-mono text-xs mb-2 text-textDim">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className={input.replace("mb-4", "mb-5")}
                placeholder="Type it again"
              />
              {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
              >
                {loading ? "SAVING..." : "SAVE NEW PASSWORD ▸"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
