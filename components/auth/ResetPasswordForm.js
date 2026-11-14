"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import AuthFrame from "@/components/auth/AuthFrame";

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
  const [diag, setDiag] = useState(""); // a short technical note (never the secret token) shown under the message so a problem can be reported accurately
  const tokenRef = useRef("");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const u = readUrl();
    setDiag("link carries: " + ([u.err && "error=" + u.err, u.tokenHash && "token_hash", u.code && "code", u.accessToken && "access_token", u.mode && "mode=" + u.mode].filter(Boolean).join(", ") || "nothing"));
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
        if (vErr) { setLoading(false); setDiag("server said: " + String(vErr.message || "").slice(0, 120)); setProblem(friendly(vErr.message)); setPhase("problem"); return; }
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

  if (phase === "done") {
    return (
      <AuthFrame title="Password updated">
        <p className="text-[15px] text-[#dcd5ff]">Taking you to your dashboard...</p>
      </AuthFrame>
    );
  }
  if (phase === "checking") {
    return (
      <AuthFrame title="Checking your link...">
        <p className="text-[15px] text-[#dcd5ff]">This only takes a moment.</p>
      </AuthFrame>
    );
  }
  if (phase === "problem") {
    return (
      <AuthFrame title="This link didn't work">
        <p className="text-[15px] leading-relaxed text-[#dcd5ff]">{problem}</p>
        {diag && <p className="mt-3 break-words font-mono text-[11px] text-[#8f86bd]">{diag}</p>}
        <Link href="/forgot-password" className="st-btn st-btn-primary mt-5 w-full">Request a new link</Link>
        <button type="button" onClick={() => { setError(""); setMode("code"); setPhase("ready"); }} className="st-link mt-4 block w-full text-center text-[14px]">
          My email shows a code
        </button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Set a new password">
      <form onSubmit={handleSubmit}>
        {mode === "code" && (
          <>
            <p className="mb-4 text-[14px] leading-relaxed text-[#c3bbea]">Enter the email address on your account and the code from the reset email.</p>
            <label htmlFor="rp-email" className="st-label">Email</label>
            <input id="rp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="st-input" placeholder="you@example.com" />
            <label htmlFor="rp-code" className="st-label mt-4">Code from the email</label>
            <input id="rp-code" type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} required autoComplete="one-time-code" className="st-input" placeholder="123456" />
          </>
        )}
        <label htmlFor="rp-password" className={`st-label ${mode === "code" ? "mt-4" : ""}`}>New password</label>
        <input
          id="rp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="st-input"
          placeholder="At least 6 characters"
        />
        <label htmlFor="rp-confirm" className="st-label mt-4">Confirm password</label>
        <input
          id="rp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="st-input"
          placeholder="Type it again"
        />
        {error && <p className="mt-4 text-[13.5px] leading-relaxed text-accentMagenta" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="st-btn st-btn-primary mt-5 w-full disabled:opacity-60">
          {loading ? "Saving..." : "Save new password"}
        </button>
      </form>
    </AuthFrame>
  );
}
