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
  for (const g of content.games ?? [])
    (g.questions ?? []).forEach(([a, b], i) => map.set(`${g.id}-${i}`, { kind: "question", text: `${a} או ${b}?`, category: g }));
  for (const p of content.powerCards) if (p.type === "guess") map.set(`pc-${p.id}`, { kind: "power", ...p });
  return map;
}

/** Report a card ("something's wrong"); shows up in the admin panel. key: answerKey, or "pc-<id>" for any power card. */
export async function reportCard({ key, game, reason, note }) {
  const res = await fetch(`${API_BASE}/api/cards/reports`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, game, reason, note }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(typeof data.detail === "string" ? data.detail : "השליחה נכשלה. נסו שוב."), { status: res.status });
  }
}

export const reportKey = (item) => (item.kind === "power" ? `pc-${item.id}` : item.answerKey);
