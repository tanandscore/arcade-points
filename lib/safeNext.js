// Where to send a player after they sign in or sign up. Only addresses inside this site are accepted ("/games/kikoleap?play=1"),
// never another website, so a crafted link can't use the login page to bounce someone elsewhere.
export function safeNext(value, fallback = "/dashboard") {
  if (typeof value !== "string" || value.length === 0 || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return fallback;
  return value;
}
