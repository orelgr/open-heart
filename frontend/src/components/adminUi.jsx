// Shared building blocks of the admin panel (Admin.jsx, AdminCards.jsx).
import { motion } from "framer-motion";
import { Inbox, Search } from "lucide-react";

export const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" });
// Spelled out (Chromium's ICU renders "לפני דקה (1)" for one unit).
const UNITS = [
  [3600, 60, "דקה", "שתי דקות", "דקות"],
  [86400, 3600, "שעה", "שעתיים", "שעות"],
  [86400 * 7, 86400, "יום", "יומיים", "ימים"],
];
export function ago(ts) {
  if (!ts) return "—";
  const s = Date.now() / 1000 - ts;
  if (s < 60) return "עכשיו";
  for (const [limit, size, one, two, many] of UNITS) {
    if (s >= limit) continue;
    const n = Math.round(s / size);
    return `לפני ${n === 1 ? one : n === 2 ? two : `${n} ${many}`}`;
  }
  return dateFmt.format(ts * 1000);
}

/** Segmented control (iOS style). */
export function Segmented({ items, value, onChange, testid }) {
  return (
    <div className="glass inline-flex rounded-full p-1" role="tablist" data-testid={testid}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          data-testid={`${testid}-${it.id}`}
          className="relative flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium"
        >
          {value === it.id && (
            <motion.span layoutId={testid} className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
          )}
          <span className={`relative transition-colors ${value === it.id ? "text-white" : "text-ink-soft"}`}>{it.label}</span>
          {it.badge > 0 && (
            <span
              className={`relative min-w-5 rounded-full px-1.5 text-[12px] font-semibold tabular-nums leading-5 ${
                value === it.id ? "bg-white/20 text-white" : "bg-clay/20 text-[#8A4B37]"
              }`}
            >
              {it.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`glass rounded-3xl p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink-soft">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon: Icon = Inbox, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
      <Icon size={28} strokeWidth={1.5} className="text-muted/60" />
      <p className="text-[15px]">{children}</p>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="glass flex h-10 min-w-0 flex-1 basis-full items-center gap-2 rounded-full px-4 sm:basis-auto sm:max-w-xs">
      <Search size={16} className="shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
      />
    </label>
  );
}

export function Skeleton() {
  return (
    <div className="grid gap-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass h-24 animate-pulse rounded-3xl opacity-60" />
      ))}
    </div>
  );
}
