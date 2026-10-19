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

export async function fetchContent() {
  const res = await fetch(`${API_BASE}/api/content`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  cacheContent(data);
  return data;
}
