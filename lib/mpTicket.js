// Multiplayer room tickets. The website (which knows who is signed in and who is an admin) hands the browser a short-lived ticket; the room
// server (a Cloudflare Durable Object, see blacksite/server/room.js) checks it before letting anyone into a room. A ticket is
//   base64url(JSON {uid, name, admin, exp}) + "." + base64url(HMAC-SHA256 of that, keyed with the server-only Supabase service key)
// so it can't be forged or edited in the browser, and it expires after a few minutes. No extra secret has to be set up anywhere.
const enc = new TextEncoder();
const b64u = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (str) => { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
async function hmacKey(secret) { return crypto.subtle.importKey("raw", enc.encode("tapandscore-mp:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }

export async function signTicket(claims, secret, ttlSeconds = 600) {
  if (!secret) throw new Error("no ticket secret");
  const body = b64u(enc.encode(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return body + "." + b64u(sig);
}

export async function verifyTicket(ticket, secret) {
  try {
    if (!ticket || !secret) return null; const [body, sig] = String(ticket).split("."); if (!body || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64u(sig), enc.encode(body)); if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(unb64u(body))); if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}
