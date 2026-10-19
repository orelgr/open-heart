// Answered cards (checked off by the couple), stored per account in FastAPI.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function call(path, method = "GET") {
  const res = await fetch(`${API_BASE}/api/cards/answered${path}`, { method, credentials: "same-origin" });
  if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
}

export const cards = {
  list: () => call(""),
  mark: (key) => call(`/${encodeURIComponent(key)}`, "PUT"),
  unmark: (key) => call(`/${encodeURIComponent(key)}`, "DELETE"),
  reset: () => call("", "DELETE"),
};

/** Every card that can be checked off, by answerKey (same keys as lib/deck.js and backend/cards.py). */
export function answerableCards(content) {
  const map = new Map();
  for (const c of content.categories) c.questions.forEach((text, i) => map.set(`${c.id}-${i}`, { kind: "question", text, category: c }));
  for (const p of content.powerCards) if (p.type === "guess") map.set(`pc-${p.id}`, { kind: "power", ...p });
  return map;
}
