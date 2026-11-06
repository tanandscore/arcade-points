"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function DeleteAccountSection({ username }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmText, setConfirmText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText === username;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmUsername: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't delete account.");
        setDeleting(false);
        return;
      }
      // The account is already gone server-side by this point —
      // signOut here just clears the now-stale local session so the
      // browser doesn't hang onto cookies for an account that no
      // longer exists, then sends them somewhere real to land on.
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't delete account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <section className="st-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 0 0 1px rgba(255,62,165,.4)" }} aria-labelledby="delete-h">
      <h2 id="delete-h" className="st-h3" style={{ color: "#ff6fb9" }}>Delete account</h2>
      {!expanded ? (
        <>
          <p className="st-muted text-[13.5px] mt-1.5 leading-relaxed">
            Permanently delete your account and all associated data. This can&apos;t be undone.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="st-btn st-btn-sm mt-4"
            style={{ background: "transparent", color: "#ff6fb9", border: "1px solid rgba(255,62,165,.7)" }}
          >
            Delete my account
          </button>
        </>
      ) : (
        <>
          <p className="st-muted text-[13.5px] mt-1.5 leading-relaxed">
            This permanently deletes your account, scores, and history. It cannot be undone. Type your username (
            <span className="text-textLight font-bold">{username}</span>) to confirm.
          </p>
          {error && <p className="text-accentMagenta text-[13.5px] mt-3">{error}</p>}
          <label htmlFor="del-confirm" className="sr-only">Type your username to confirm</label>
          <input
            id="del-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            autoComplete="off"
            className="st-input mt-3"
          />
          <div className="flex flex-wrap gap-2.5 mt-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="st-btn st-btn-sm disabled:opacity-40"
              style={{ background: "#ff3ea5", color: "#fff" }}
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setConfirmText("");
                setError("");
              }}
              className="st-btn st-btn-ghost st-btn-sm"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}
