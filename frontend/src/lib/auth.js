// Account API. The session lives in an HttpOnly cookie set by FastAPI, so no token ever touches JS
// or localStorage; we only keep the signed-in user object in React state.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/api/auth${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? "אחד השדות אינו תקין" : data.detail;
    throw Object.assign(new Error(detail || "משהו השתבש. נסו שוב."), { status: res.status });
  }
  return data;
}

export const auth = {
  me: () => call("/session").then((d) => d?.user ?? null), // never undefined, or the app waits forever
  register: (email, name, partner, password, consent) =>
    call("/register", { method: "POST", body: { email, name, partner, password, consent } }),
  login: (login, password) => call("/login", { method: "POST", body: { login, password } }), // email or either name
  logout: () => call("/logout", { method: "POST" }),
  updateName: (name, partner) => call("/me", { method: "PATCH", body: { name, partner } }),
  changePassword: (current, next) => call("/password", { method: "POST", body: { current, new: next } }),
  exportData: () => call("/export"),
  deleteAccount: (password) => call("/me", { method: "DELETE", body: { password } }),
};

export const PASSWORD_MIN = 12;
