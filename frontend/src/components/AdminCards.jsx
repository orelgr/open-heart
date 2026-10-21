import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, Flag, PencilLine, Plus, Trash2, TriangleAlert, Zap } from "lucide-react";
import { Empty, Panel, SearchBox, Skeleton } from "./adminUi.jsx";
import { admin, REASONS } from "../lib/admin.js";
import { toneOf } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

const TEXT_MAX = 300;
const OPTION_MAX = 120;
const POWER_TYPES = { challenge: "אתגר", power: "כוח", guess: "מה יענה?" };

/** Every editable group: the 6 categories, games with their own questions ("זה או זה"), power cards.
 *  Keys match lib/deck.js / backend (answerKey, "pc-<id>"). */
function groupsOf(content) {
  return [
    ...content.categories.map((c) => ({
      id: c.id,
      title: c.title,
      tone: c.tone,
      kind: "question",
      cards: c.questions.map((text, i) => ({ key: `${c.id}-${i}`, n: i + 1, text })),
    })),
    ...(content.games ?? [])
      .filter((g) => g.questions)
      .map((g) => ({
        id: g.id,
        title: g.title,
        tone: g.tone,
        kind: "pair",
        topic: g.format === "topic", // [title, prompt] instead of [a, b]
        cards: g.questions.map((options, i) => ({ key: `${g.id}-${i}`, n: i + 1, options, text: options.join(g.format === "topic" ? ": " : " או ") })),
      })),
    {
      id: "power",
      title: "קלפי כוח",
      tone: null,
      kind: "power",
      cards: content.powerCards.map((p, i) => ({ key: `pc-${p.id}`, n: i + 1, title: p.title, text: p.text, type: p.type })),
    },
  ];
}

const groupOfKey = (groups, key) => groups.find((g) => g.cards.some((c) => c.key === key));

const inputCls =
  "w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-[16px] leading-relaxed text-ink outline-none ring-gold/60 focus:ring-2";

/** Inline editor for one card (also used to add a card). */
const PLACEHOLDERS = { pair: ["אפשרות ראשונה", "אפשרות שנייה"], topic: ["כותרת הנושא", "שורת פתיחה"] };

function CardEditor({ kind, topic, card, onSave, onCancel, busy }) {
  const [text, setText] = useState(card?.text ?? "");
  const [title, setTitle] = useState(card?.title ?? "");
  const [options, setOptions] = useState(card?.options ?? ["", ""]);
  const first = useRef(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);

  const valid = kind === "pair" ? options.every((o) => o.trim().length >= 2) : text.trim().length >= 2 && (kind !== "power" || title.trim().length >= 2);
  const submit = (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    onSave(kind === "pair" ? { options } : kind === "power" ? { title, text } : { text });
  };

  return (
    <form onSubmit={submit} className="grid gap-2.5" data-testid="card-editor">
      {kind === "pair" ? (
        options.map((o, i) => (
          <input
            key={i}
            ref={i === 0 ? first : undefined}
            value={o}
            maxLength={OPTION_MAX}
            onChange={(e) => setOptions(options.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={PLACEHOLDERS[topic ? "topic" : "pair"][i]}
            className={`${inputCls} font-display`}
          />
        ))
      ) : (
        <>
          {kind === "power" && (
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת" className={inputCls} />
          )}
          <textarea
            ref={first}
            value={text}
            maxLength={TEXT_MAX}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit(e)}
            placeholder="טקסט הקלף"
            className={`${inputCls} resize-none font-display text-[18px]`}
            data-testid="card-editor-text"
          />
        </>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!valid || busy}
          className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40"
          data-testid="card-save"
        >
          <Check size={16} strokeWidth={2.2} />
          {busy ? "שומרים…" : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="h-10 px-3 text-[14px] text-muted">
          ביטול
        </button>
        {kind !== "pair" && <span className="ms-auto text-[12px] tabular-nums text-muted/70">{text.length}/{TEXT_MAX}</span>}
      </div>
    </form>
  );
}

function CardRow({ label, group, card, reports, focused, editing, setEditing, onSave, onDelete, onResolve, busy }) {
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focused]);

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`rounded-2xl border px-4 py-3 transition-colors duration-300 ${
        focused ? "border-gold/60 bg-gold/8 ring-2 ring-gold/25" : "border-transparent hover:bg-white/50"
      }`}
      data-testid={`admin-card-${card.key}`}
    >
      {editing ? (
        <CardEditor kind={group.kind} topic={group.topic} card={card} busy={busy} onSave={(body) => onSave(card.key, body)} onCancel={() => setEditing(null)} />
      ) : (
        <div className="flex items-start gap-3">
          <span className="mt-1 w-6 shrink-0 text-[12px] tabular-nums text-muted/70">{card.n}</span>
          <div className="min-w-0 flex-1">
            {label && <p className="mb-0.5 text-[11px] font-medium text-muted">{label}</p>}
            {group.kind === "power" && (
              <p className="mb-0.5 flex items-center gap-1.5 text-[12px] font-medium text-[#7F5F2A]">
                <Zap size={12} strokeWidth={2} />
                {card.title}
                <span className="font-normal text-muted">· {POWER_TYPES[card.type] ?? card.type}</span>
              </p>
            )}
            <p className="font-display text-[17px] leading-snug">{card.text}</p>
          </div>
          {reports.length > 0 && (
            <span
              className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-clay/15 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#8A4B37]"
              title="דיווחים פתוחים"
            >
              <Flag size={11} strokeWidth={2.2} />
              {reports.length}
            </span>
          )}
          {confirm ? null : (
            <div className="-my-1 flex shrink-0 items-center">
              <button
                onClick={() => setEditing(card.key)}
                aria-label="עריכת הקלף"
                title="עריכה"
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
                data-testid="card-edit"
              >
                <PencilLine size={16} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setConfirm(true)}
                aria-label="מחיקת הקלף"
                title="מחיקה"
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-[#8A4B37]"
                data-testid="card-delete"
              >
                <Trash2 size={16} strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>
      )}

      {confirm && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-clay/10 px-3 py-2">
          <p className="flex-1 text-[13px] text-[#8A4B37]">הקלף יוסר מהמשחק לכל הזוגות.</p>
          <button onClick={() => setConfirm(false)} className="h-9 px-3 text-[14px] text-muted">
            ביטול
          </button>
          <button
            onClick={() => onDelete(card.key)}
            disabled={busy}
            className="h-9 rounded-full bg-[#8A4B37] px-4 text-[14px] font-medium text-white disabled:opacity-50"
            data-testid="card-delete-confirm"
          >
            מחיקה
          </button>
        </div>
      )}

      {/* Opened from a report: what players said about this card, right where it is fixed. */}
      {focused && reports.length > 0 && (
        <div className="mt-3 grid gap-1.5 rounded-xl bg-white/70 p-3" data-testid="card-reports">
          <p className="text-[12px] font-semibold text-[#8A4B37]">דיווחים פתוחים על הקלף</p>
          {reports.map((r) => (
            <p key={r.id} className="text-[14px] leading-relaxed text-ink-soft">
              <span className="me-1.5 rounded-full border border-ink/10 px-2 py-px text-[12px]">{REASONS[r.reason] ?? r.reason}</span>
              {r.note}
            </p>
          ))}
          <button
            onClick={() => onResolve(reports.map((r) => r.id))}
            className="mt-1 flex h-9 w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3.5 text-[13px] font-medium text-ink-soft"
            data-testid="card-reports-resolve"
          >
            <Check size={14} strokeWidth={2.2} />
            סימון הדיווחים כטופלו
          </button>
        </div>
      )}
    </motion.li>
  );
}

export default function AdminCards({ focusKey, onChanged, onContent, toast }) {
  const [data, setData] = useState(null); // { content, edited, repoNewer }
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [editing, setEditing] = useState(null); // card key | "new"
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const justAdded = useRef(null); // a new card is highlighted, not opened for editing

  const loadReports = useCallback(() => admin.reports("open").then(setReports).catch(() => {}), []);
  useEffect(() => {
    admin
      .content()
      .then(setData)
      .catch((e) => setError(e.message));
    loadReports();
  }, [loadReports]);

  const groups = useMemo(() => (data ? groupsOf(data.content) : []), [data]);
  const reportsByKey = useMemo(() => {
    const m = new Map();
    for (const r of reports) m.set(r.key, [...(m.get(r.key) ?? []), r]);
    return m;
  }, [reports]);

  // Deep link from a report: jump to the card's group and open its editor.
  useEffect(() => {
    if (!focusKey || !groups.length) return;
    const g = groupOfKey(groups, focusKey);
    if (g) {
      setGroupId(g.id);
      setQ("");
      setEditing(justAdded.current === focusKey ? null : focusKey);
    }
  }, [focusKey, groups]);

  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  const needle = q.trim();
  const results = needle
    ? groups.flatMap((g) => g.cards.filter((c) => `${c.title ?? ""} ${c.text}`.includes(needle)).map((c) => ({ group: g, card: c })))
    : null;

  const apply = async (fn, done) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setData(res);
      onContent?.(res.content);
      onChanged?.();
      await loadReports();
      done?.(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = (key, body) =>
    apply(
      () => admin.editCard(key, body),
      () => {
        setEditing(null);
        toast("הקלף נשמר");
      }
    );
  const add = (body) =>
    apply(
      () => admin.addCard(group.id, body),
      (res) => {
        setEditing(null);
        justAdded.current = res.key;
        navigate(`/admin/cards/${encodeURIComponent(res.key)}`);
        toast("הקלף נוסף");
      }
    );
  const remove = (key) =>
    apply(
      () => admin.deleteCard(key),
      () => {
        setEditing(null);
        if (focusKey) navigate("/admin/cards"); // keys after it shifted: the old deep link is stale
        toast("הקלף נמחק");
      }
    );
  const resolve = async (ids) => {
    try {
      await admin.setStatus(ids, "resolved");
      await loadReports();
      onChanged?.();
      toast("הדיווחים סומנו כטופלו");
    } catch (e) {
      setError(e.message);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.content, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "questions.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return error ? <Panel><Empty icon={TriangleAlert}>{error}</Empty></Panel> : <Skeleton />;

  const row = (g, c, label) => (
    <CardRow
      key={`${c.key}:${c.title ?? ""}:${c.text}`} // keys are positional: after a delete, the next card must not inherit this row's state
      label={label}
      group={g}
      card={c}
      reports={reportsByKey.get(c.key) ?? []}
      focused={c.key === focusKey}
      editing={editing === c.key}
      setEditing={setEditing}
      onSave={save}
      onDelete={remove}
      onResolve={resolve}
      busy={busy}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="חיפוש בכל הקלפים" />
        <button onClick={download} className="glass flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] text-ink-soft" title="הורדת קובץ התוכן">
          <Download size={16} strokeWidth={1.8} />
          JSON
        </button>
      </div>
      {data.repoNewer && (
        <p className="flex items-start gap-2 rounded-2xl bg-gold/12 px-4 py-3 text-[13px] leading-relaxed text-[#7F5F2A]">
          <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          קובץ התוכן שבקוד (backend/questions.json) עודכן אחרי העריכה האחרונה כאן. המשחק ממשיך להציג את הגרסה שנערכה בפאנל.
        </p>
      )}
      {error && <p className="rounded-2xl bg-clay/15 px-4 py-3 text-[15px] text-[#8A4B37]">{error}</p>}

      {results ? (
        <Panel title={`${results.length} תוצאות`}>
          {results.length ? (
            <ul className="-mx-2 grid gap-0.5">{results.map(({ group: g, card: c }) => row(g, c, g.title))}</ul>
          ) : (
            <Empty>לא נמצאו קלפים</Empty>
          )}
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
          {/* Groups: chips on phones, a sticky list on wider screens */}
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:sticky md:top-4 md:mx-0 md:grid md:gap-1 md:overflow-visible md:px-0" data-testid="card-groups">
            {groups.map((g) => {
              const open = g.cards.reduce((n, c) => n + (reportsByKey.get(c.key)?.length ?? 0), 0);
              const active = g.id === group.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setGroupId(g.id);
                    setEditing(null);
                    if (focusKey) navigate("/admin/cards");
                  }}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] transition-colors md:h-auto md:min-h-10 md:w-full md:rounded-2xl md:py-2 md:text-right ${
                    active ? "bg-ink text-white" : "glass text-ink-soft md:border-transparent md:bg-transparent md:shadow-none md:backdrop-blur-none md:hover:bg-white/60"
                  }`}
                  data-testid={`card-group-${g.id}`}
                >
                  {g.tone ? (
                    <span className="size-2 shrink-0 rounded-full" style={{ background: toneOf(g.tone).to }} />
                  ) : (
                    <Zap size={13} strokeWidth={2} className={active ? "text-gold-soft" : "text-gold"} />
                  )}
                  <span className="whitespace-nowrap md:min-w-0 md:whitespace-normal md:leading-snug">{g.title}</span>
                  <span className={`ms-auto ps-2 text-[12px] tabular-nums ${active ? "text-white/60" : "text-muted/70"}`}>{g.cards.length}</span>
                  {open > 0 && <span className="size-1.5 shrink-0 rounded-full bg-[#B5654A]" title={`${open} דיווחים פתוחים`} />}
                </button>
              );
            })}
          </nav>

          <Panel
            title={group.title}
            action={
              group.kind !== "power" &&
              editing !== "new" && (
                <button
                  onClick={() => setEditing("new")}
                  className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-gold hover:bg-gold/10"
                  data-testid="card-add"
                >
                  <Plus size={15} strokeWidth={2} />
                  קלף חדש
                </button>
              )
            }
          >
            {editing === "new" && (
              <div className="mb-3 rounded-2xl border border-gold/40 bg-gold/5 p-3">
                <CardEditor kind={group.kind} topic={group.topic} busy={busy} onSave={add} onCancel={() => setEditing(null)} />
              </div>
            )}
            {group.cards.length ? (
              <ul className="-mx-2 grid gap-0.5" data-testid="admin-card-list">
                {group.cards.map((c) => row(group, c))}
              </ul>
            ) : (
              <Empty>אין קלפים בקטגוריה הזו</Empty>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
