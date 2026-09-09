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
    <div className="rounded-xl border border-accentMagenta/50 p-6 bg-bgPanel">
      <h2 className="font-pixel text-[10px] text-accentMagenta mb-2">DELETE ACCOUNT</h2>
      {!expanded ? (
        <>
          <p className="text-textDim text-xs mb-4">
            Permanently delete your account and all associated data. This can&apos;t be undone.
          </p>
          <button
            onClick={() => setExpanded(true)}
            className="font-mono text-[10px] px-4 py-2 rounded-md border border-accentMagenta text-accentMagenta"
          >
            Delete my account
          </button>
        </>
      ) : (
        <>
          <p className="text-textDim text-xs mb-3">
            This permanently deletes your account, scores, and history. It cannot be undone. Type your username (
            <span className="text-textLight font-bold">{username}</span>) to confirm.
          </p>
          {error && <p className="text-accentMagenta text-xs mb-3">{error}</p>}
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            className="w-full rounded-md px-3 py-2 text-xs bg-bgDeep border border-lineColor text-textLight font-mono mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="font-mono text-[10px] px-4 py-2 rounded-md bg-accentMagenta text-white disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                setConfirmText("");
                setError("");
              }}
              className="font-mono text-[10px] px-4 py-2 rounded-md border border-lineColor text-textDim"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
