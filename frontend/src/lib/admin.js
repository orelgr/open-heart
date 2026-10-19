// Admin panel API (FastAPI /api/admin, admin account only).
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(typeof data.detail === "string" ? data.detail : "משהו השתבש. נסו שוב."), { status: res.status });
  return data;
}

export const admin = {
  overview: () => call("/overview"),
  reports: (status) => call(`/reports?status=${status}`),
  setStatus: (ids, status) => call("/reports", { method: "PATCH", body: { ids, status } }),
  remove: (ids) => call("/reports/delete", { method: "POST", body: { ids } }),
  users: () => call("/users"),
  // Card editor: each call returns { content, edited, repoNewer } (POST also the new card's key).
  content: () => call("/content"),
  editCard: (key, body) => call(`/cards/${encodeURIComponent(key)}`, { method: "PUT", body }),
  addCard: (group, body) => call("/cards", { method: "POST", body: { group, ...body } }),
  deleteCard: (key) => call(`/cards/${encodeURIComponent(key)}`, { method: "DELETE" }),
};

export const REASONS = {
  unclear: "ניסוח לא ברור",
  typo: "שגיאת כתיב",
  inappropriate: "לא מתאים",
  duplicate: "חוזר על עצמו",
  other: "אחר",
};
