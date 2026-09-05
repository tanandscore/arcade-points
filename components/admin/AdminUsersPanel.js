"use client";

import { useEffect, useState } from "react";

export default function AdminUsersPanel({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState("");

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

  return (
    <div>
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
          <input
            type="text"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="starting password"
            className="rounded-md px-3 py-2.5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          />
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
        <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="p-4 border-b border-lineColor last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-textLight">
                    {u.username || "(no username)"} {u.isAdmin && <span className="text-accentAmber text-xs ml-1">★ admin</span>}
                    {u.id === currentUserId && <span className="text-textDim text-xs ml-1">(you)</span>}
                  </p>
                  <p className="text-[11px] text-textDim font-mono">{u.email}</p>
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
      )}
    </div>
  );
}
