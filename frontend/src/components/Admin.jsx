import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Flag, PencilLine, RefreshCw, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import AdminCards from "./AdminCards.jsx";
import { ago, dateFmt, Empty, Panel, SearchBox, Segmented, Skeleton } from "./adminUi.jsx";
import { IconButton } from "./ui.jsx";
import { admin, REASONS } from "../lib/admin.js";
import { navigate } from "../lib/router.js";

const TABS = [
  { id: "overview", path: "/admin", label: "סקירה" },
  { id: "reports", path: "/admin/reports", label: "דיווחים" },
  { id: "cards", path: "/admin/cards", label: "קלפים" },
  { id: "users", path: "/admin/users", label: "משתמשים" },
];

/* ---------- Overview ---------- */
function Stat({ label, value, sub, tone, onClick, testid }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="glass flex flex-col items-start gap-1 rounded-3xl p-5 text-right" data-testid={testid}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className={`font-display text-[38px] leading-none tabular-nums ${tone ?? "text-ink"}`}>{value ?? "—"}</span>
      <span className="text-[13px] text-muted/80">{sub ?? " "}</span>
    </Tag>
  );
}

function CardList({ rows, empty, unit }) {
  if (!rows?.length) return <p className="py-6 text-center text-[14px] text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-display text-[16px]">{r.text}</p>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">
              {r.count} {unit}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-ink/6">
            <div className="h-full rounded-full bg-gold/70" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Overview({ data }) {
  if (!data) return <Skeleton />;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="זוגות רשומים" value={data.users} sub={data.newUsers ? `+${data.newUsers} השבוע` : "אין חדשים השבוע"} testid="stat-users" />
        <Stat label="פעילים השבוע" value={data.activeUsers} sub={data.users ? `${Math.round((data.activeUsers / data.users) * 100)}% מהזוגות` : null} />
        <Stat
          label="דיווחים פתוחים"
          value={data.openReports}
          sub={data.openReports ? "ממתינים לטיפול" : "הכל טופל"}
          tone={data.openReports ? "text-[#8A4B37]" : "text-ink"}
          onClick={() => navigate("/admin/reports")}
          testid="stat-reports"
        />
        <Stat label="קלפים שנענו" value={data.answered} sub="סימוני ✓ של כל הזוגות" />
      </div>
      {data.failedLogins > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-clay/12 px-4 py-3 text-[14px] text-[#8A4B37]">
          <ShieldAlert size={16} strokeWidth={1.8} />
          {data.failedLogins} ניסיונות התחברות כושלים ב-24 השעות האחרונות
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title="הכי מדווחים"
          action={
            <button onClick={() => navigate("/admin/reports")} className="text-[13px] font-medium text-gold">
              לכל הדיווחים
            </button>
          }
        >
          <CardList rows={data.topReported} unit="דיווחים" empty="אין דיווחים פתוחים" />
        </Panel>
        <Panel title="הכי נענים">
          <CardList rows={data.topAnswered} unit="זוגות" empty="עוד לא סומנו קלפים" />
        </Panel>
      </div>
    </div>
  );
}

/* ---------- Reports ---------- */
const STATUSES = [
  { id: "open", label: "פתוחים" },
  { id: "resolved", label: "טופלו" },
  { id: "all", label: "הכל" },
];

/** One reported card with all its reports (a card reported 3 times is one item to fix, not three). */
function ReportGroup({ group, onStatus, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const open = group.items.filter((r) => r.status === "open");
  const first = group.items[0];
  const reasons = Object.entries(
    group.items.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {})
  );
  const ids = group.items.map((r) => r.id);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      className={`glass rounded-3xl p-5 ${open.length ? "" : "opacity-70"}`}
      data-testid="report-item"
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted">
        {first.group && <span className="rounded-full bg-ink/6 px-2.5 py-0.5">{first.group}</span>}
        {[...new Set(group.items.map((r) => r.game).filter(Boolean))].map((g) => (
          <span key={g} className="rounded-full bg-gold/12 px-2.5 py-0.5 text-[#7F5F2A]">
            {g}
          </span>
        ))}
        <span className="ms-auto tabular-nums">{ago(first.createdAt)}</span>
      </div>

      <p className="mt-3 font-display text-[19px] leading-snug">{first.text}</p>
      {first.current && <p className="mt-1 text-[13px] text-sage">עודכן מאז: {first.current}</p>}
      {first.removed && <p className="mt-1 text-[13px] text-muted">הקלף כבר לא קיים בחפיסה</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {reasons.map(([reason, n]) => (
          <span key={reason} className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[12px] text-ink-soft">
            {REASONS[reason] ?? reason}
            {n > 1 && <span className="ms-1 tabular-nums text-muted">×{n}</span>}
          </span>
        ))}
      </div>

      {group.items.some((r) => r.note) && (
        <ul className="mt-3 grid gap-1.5 border-s-2 border-gold/40 ps-3">
          {group.items
            .filter((r) => r.note)
            .map((r) => (
              <li key={r.id} className="text-[14px] leading-relaxed text-ink-soft">
                {r.note}
                <span className="ms-2 text-[12px] text-muted/70">{ago(r.createdAt)}</span>
              </li>
            ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        {open.length ? (
          <button
            onClick={() => onStatus(open.map((r) => r.id), "resolved")}
            className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-medium text-white"
            data-testid="report-resolve"
          >
            <Check size={16} strokeWidth={2.2} />
            סימון כטופל
            {group.items.length > 1 && <span className="tabular-nums opacity-70">({open.length})</span>}
          </button>
        ) : (
          <button
            onClick={() => onStatus(ids, "open")}
            className="flex h-10 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-[14px] font-medium text-ink-soft"
            data-testid="report-reopen"
          >
            <RotateCcw size={15} />
            פתיחה מחדש
          </button>
        )}
        {!first.removed && (
          <button
            onClick={() => navigate(`/admin/cards/${encodeURIComponent(group.key)}`)}
            className="flex h-10 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-[14px] font-medium text-ink-soft"
            data-testid="report-edit-card"
          >
            <PencilLine size={15} strokeWidth={1.8} />
            לקלף
          </button>
        )}
        <span className="ms-auto" />
        {confirm ? (
          <>
            <button onClick={() => setConfirm(false)} className="h-10 px-3 text-[14px] text-muted">
              ביטול
            </button>
            <button
              onClick={() => onDelete(ids)}
              className="h-10 rounded-full bg-[#8A4B37] px-4 text-[14px] font-medium text-white"
              data-testid="report-delete-confirm"
            >
              למחוק {group.items.length > 1 ? `${group.items.length} דיווחים` : "את הדיווח"}
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            aria-label="מחיקת הדיווח"
            title="מחיקה"
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-ink/5"
            data-testid="report-delete"
          >
            <Trash2 size={17} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </motion.article>
  );
}

function Reports({ onChanged, toast }) {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setError(null);
    admin.reports(status).then(setRows).catch((e) => setError(e.message));
  }, [status]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const groups = useMemo(() => {
    const needle = q.trim();
    const map = new Map();
    for (const r of rows ?? []) {
      if (needle && ![r.text, r.note, r.group, r.game].some((s) => s?.includes(needle))) continue;
      if (!map.has(r.key)) map.set(r.key, { key: r.key, items: [] });
      map.get(r.key).items.push(r);
    }
    return [...map.values()];
  }, [rows, q]);

  const changeStatus = async (ids, next) => {
    try {
      await admin.setStatus(ids, next);
      load();
      onChanged();
      if (next === "resolved")
        toast(ids.length > 1 ? `${ids.length} דיווחים סומנו כטופלו` : "הדיווח סומן כטופל", async () => {
          await admin.setStatus(ids, "open");
          load();
          onChanged();
        });
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (ids) => {
    try {
      await admin.remove(ids);
      setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
      onChanged();
      toast("נמחק");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented items={STATUSES} value={status} onChange={setStatus} testid="report-status" />
        <SearchBox value={q} onChange={setQ} placeholder="חיפוש בקלף או בהערה" />
      </div>
      {error && <p className="rounded-2xl bg-clay/15 px-4 py-3 text-[15px] text-[#8A4B37]">{error}</p>}
      {!rows ? (
        <Skeleton />
      ) : !groups.length ? (
        <Panel>
          <Empty icon={Flag}>{q ? "לא נמצאו דיווחים מתאימים" : status === "open" ? "אין דיווחים פתוחים. הכל נקי." : "אין דיווחים"}</Empty>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2" data-testid="report-list">
          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <ReportGroup key={g.key} group={g} onStatus={changeStatus} onDelete={remove} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ---------- Users ---------- */
function Users() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    admin.users().then(setRows).catch((e) => setError(e.message));
  }, []);
  const needle = q.trim().toLowerCase();
  const list = (rows ?? []).filter((u) => !needle || `${u.name} ${u.partner} ${u.email}`.toLowerCase().includes(needle));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="חיפוש לפי שם" />
        {rows && <span className="text-[14px] tabular-nums text-muted">{list.length} זוגות</span>}
      </div>
      {error && <p className="rounded-2xl bg-clay/15 px-4 py-3 text-[15px] text-[#8A4B37]">{error}</p>}
      {!rows ? (
        <Skeleton />
      ) : !list.length ? (
        <Panel>
          <Empty>{q ? "לא נמצאו משתמשים" : "עוד אין משתמשים"}</Empty>
        </Panel>
      ) : (
        <div className="glass overflow-hidden rounded-3xl" data-testid="user-list">
          <table className="w-full text-right text-[14px]">
            <thead className="hidden text-[12px] font-medium text-muted md:table-header-group">
              <tr className="border-b border-hairline">
                <th className="px-5 py-3 font-medium">זוג</th>
                <th className="px-3 py-3 font-medium">מייל</th>
                <th className="px-3 py-3 font-medium">הצטרפו</th>
                <th className="px-3 py-3 font-medium">פעילות אחרונה</th>
                <th className="px-3 py-3 text-left font-medium">נענו</th>
                <th className="px-5 py-3 text-left font-medium">דיווחים</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-hairline px-5 py-3 last:border-0 md:table-row md:px-0 md:py-0">
                  <td className="md:px-5 md:py-3">
                    <span className="font-medium text-ink">{u.partner ? `${u.name} ו${u.partner}` : u.name}</span>
                  </td>
                  <td className="order-3 col-span-2 text-[13px] text-muted md:px-3 md:py-3" dir="ltr" style={{ textAlign: "right" }}>
                    {u.email}
                  </td>
                  <td className="hidden text-muted md:table-cell md:px-3 md:py-3">{dateFmt.format(u.createdAt * 1000)}</td>
                  <td className="text-[13px] text-muted md:px-3 md:py-3 md:text-[14px]">{ago(u.lastActive)}</td>
                  <td className="hidden text-left tabular-nums md:table-cell md:px-3 md:py-3">{u.answered}</td>
                  <td className="hidden text-left tabular-nums md:table-cell md:px-5 md:py-3">{u.reports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
export default function AdminPage({ route, onContent }) {
  // #/admin/cards/<key> opens the card editor on that card (from a report).
  const cardKey = route.startsWith("/admin/cards/") ? decodeURIComponent(route.slice("/admin/cards/".length)) : null;
  const tab = cardKey ? "cards" : TABS.find((t) => t.path === route)?.id ?? "overview";
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { text, undo? }
  const [spin, setSpin] = useState(0);
  const timer = useRef();

  const refresh = useCallback(() => {
    admin
      .overview()
      .then((d) => {
        setOverview(d);
        setError(null);
      })
      .catch((e) => setError(e.status === 403 ? "אין לחשבון הזה הרשאת ניהול" : e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const toast = useCallback((text, undo) => {
    clearTimeout(timer.current);
    setNotice({ text, undo });
    timer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.07 } }}
      transition={{ duration: 0.16 }}
      className="h-dvh overflow-y-auto"
      data-testid="admin"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 safe-top sm:px-8">
        <header className="flex items-center gap-3 pt-2">
          <IconButton label="חזרה למשחק" onClick={() => navigate("/")}>
            <ChevronRight size={22} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[30px] leading-none">ניהול</h1>
            <p className="mt-1 text-[10px] font-medium tracking-[0.36em] text-gold">OPEN HEART · ADMIN</p>
          </div>
          <IconButton
            label="רענון"
            onClick={() => {
              setSpin((s) => s + 1); // also re-mounts the open tab (key) so it reloads
              refresh();
            }}
          >
            <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.5 }} className="flex">
              <RefreshCw size={18} strokeWidth={1.8} />
            </motion.span>
          </IconButton>
        </header>

        <nav className="mt-6">
          <Segmented
            items={TABS.map((t) => ({ ...t, badge: t.id === "reports" ? overview?.openReports : 0 }))}
            value={tab}
            onChange={(id) => navigate(TABS.find((t) => t.id === id).path)}
            testid="admin-tab"
          />
        </nav>

        <div className="mt-5">
          {error ? (
            <Panel>
              <Empty icon={ShieldAlert}>{error}</Empty>
            </Panel>
          ) : tab === "overview" ? (
            <Overview data={overview} />
          ) : tab === "reports" ? (
            <Reports key={`reports-${spin}`} onChanged={refresh} toast={toast} />
          ) : tab === "cards" ? (
            <AdminCards key={`cards-${spin}`} focusKey={cardKey} onChanged={refresh} onContent={onContent} toast={toast} />
          ) : (
            <Users key={`users-${spin}`} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),20px)] z-50 mx-auto flex w-fit max-w-[calc(100%-32px)] items-center gap-4 rounded-full bg-ink px-5 py-3 text-[14px] text-white shadow-[var(--shadow-card)]"
            role="status"
            data-testid="admin-toast"
          >
            {notice.text}
            {notice.undo && (
              <button
                onClick={() => {
                  notice.undo();
                  setNotice(null);
                }}
                className="font-semibold text-gold-soft"
              >
                ביטול
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
