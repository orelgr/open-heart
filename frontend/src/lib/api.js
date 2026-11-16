// Stale-while-revalidate content loader: instant render from cache, refresh from FastAPI.
const KEY = "open-heart:content:v1";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function readCachedContent() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheContent(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable - fine */
  }
}

/** Signed out: the cards are for signed-in couples only, so none stay on the device. */
export function clearCachedContent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable - fine */
  }
}

export async function fetchContent() {
  const res = await fetch(`${API_BASE}/api/content`, { credentials: "same-origin" }); // needs the session cookie
  if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { status: res.status });
  const data = await res.json();
  cacheContent(data);
  return data;
}
