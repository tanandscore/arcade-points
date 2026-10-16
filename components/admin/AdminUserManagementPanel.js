"use client";

import { useEffect, useState } from "react";

function generatePassword() {
  // Mixed case + digits + a couple of symbols, 14 chars — a real
  // starting password strength, not a weak default the admin then
  // has to remember to strengthen.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function SubscriptionBadge({ sub }) {
  const color = sub.status === "active" ? (sub.cancelAtPeriodEnd ? "#ffb703" : "#6bff6b") : "#ff3ea5";
  const label =
    sub.status === "active"
      ? sub.cancelAtPeriodEnd
        ? "Cancelling"
        : "Active"
      : sub.status;
  return (
    <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border" style={{ borderColor: color, color }}>
      {sub.planId}: {label}
      {sub.currentPeriodEnd && ` · until ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
    </span>
  );
}

export default function AdminUserManagementPanel({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [busyId, setBusyId] = useState(null);
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [rowMessage, setRowMessage] = useState({});

  async function loadUsers() {
    setLoadError("");
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error || "Couldn't load users.");
      return;
    }
    setUsers(data.users);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: newPassword, username: newUsername }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(data.error || "Couldn't create user.");
      return;
    }
    setNewEmail("");
    setNewPassword("");
    setNewUsername("");
    loadUsers();
  }

  async function handleDelete(id) {
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setRowMessage((m) => ({ ...m, [id]: data.error || "Delete failed." }));
      return;
    }
    loadUsers();
  }

  async function handlePasswordChange(id) {
    const password = passwordDrafts[id];
    if (!password || password.length < 6) {
      setRowMessage((m) => ({ ...m, [id]: "Password must be at least 6 characters." }));
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setRowMessage((m) => ({ ...m, [id]: data.error || "Couldn't update password." }));
      return;
    }
    setRowMessage((m) => ({ ...m, [id]: "Password updated." }));
    setPasswordDrafts((d) => ({ ...d, [id]: "" }));
  }

  const filteredUsers = users
    ? users.filter((u) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
      })
    : null;

  return (
    <div>
      <div className="rounded-md border border-accentAmber/40 bg-accentAmber/10 p-3 mb-6">
        <p className="font-mono text-[10px] text-accentAmber">
          Passwords are one-way hashed — there's no such thing as "viewing" a user's current password, by design.
          What's here instead: setting a brand new one for them, which invalidates whatever they had.
        </p>
      </div>

      {/* Create user */}
      <form onSubmit={handleCreate} className="rounded-xl border border-lineColor p-5 bg-bgPanel mb-8">
        <h2 className="font-pixel text-[10px] text-accentCyan mb-4">ADD A USER</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          />
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="username (optional)"
            maxLength={16}
            className="rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          />
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="starting password"
              className="flex-1 rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight min-w-0"
            />
            <button
              type="button"
              onClick={() => setNewPassword(generatePassword())}
              className="font-mono text-[10px] px-3 rounded-md border border-lineColor text-textDim whitespace-nowrap"
            >
              Generate
            </button>
          </div>
        </div>
        {createError && <p className="text-accentMagenta text-xs mb-3">{createError}</p>}
        <button
          type="submit"
          disabled={creating}
          className="font-pixel text-[10px] px-5 py-2.5 rounded-md bg-accentCyan text-bgDeep disabled:opacity-50"
        >
          {creating ? "CREATING..." : "CREATE USER ▸"}
        </button>
      </form>

      {/* User list */}
      {loadError && <p className="text-accentMagenta text-sm mb-4">{loadError}</p>}
      {!users && !loadError && <p className="text-textDim text-sm">Loading users...</p>}

      {users && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or username..."
            className="w-full rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight mb-4"
          />
          <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-4 border-b border-lineColor last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-textLight">
                      {u.username || "(no username)"} {u.isAdmin && <span className="text-accentAmber text-xs ml-1">★ admin</span>}
                      {u.id === currentUserId && <span className="text-textDim text-xs ml-1">(you)</span>}
                    </p>
                    <p className="text-[11px] text-textDim font-mono">{u.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {u.subscriptions.length === 0 && !u.bonusUntil && (
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-lineColor text-textDim">No subscription</span>
                      )}
                      {u.subscriptions.map((sub) => (
                        <SubscriptionBadge key={sub.planId} sub={sub} />
                      ))}
                      {u.bonusUntil && (
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-accentCyan text-accentCyan">
                          Bonus access until {new Date(u.bonusUntil).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={busyId === u.id || u.id === currentUserId}
                    className="font-mono text-[10px] px-3 py-1.5 rounded-md border text-accentMagenta disabled:opacity-40"
                    style={{ borderColor: "#ff3ea5" }}
                  >
                    Delete
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={passwordDrafts[u.id] || ""}
                    onChange={(e) => setPasswordDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                    placeholder="new password"
                    className="rounded-md px-2.5 py-1.5 outline-none text-xs bg-bgDeep border border-lineColor text-textLight w-40"
                  />
                  <button
                    onClick={() => setPasswordDrafts((d) => ({ ...d, [u.id]: generatePassword() }))}
                    className="font-mono text-[10px] px-2.5 py-1.5 rounded-md border border-lineColor text-textDim"
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => handlePasswordChange(u.id)}
                    disabled={busyId === u.id}
                    className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight disabled:opacity-40"
                  >
                    Set password
                  </button>
                  {rowMessage[u.id] && <span className="text-[11px] text-textDim">{rowMessage[u.id]}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
